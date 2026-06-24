import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { MikroLensSessionCookieSameSite } from "../../config/MikroLensConfiguration.ts";
import type { UserDTO } from "../../domain/User.ts";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE_NAME = "mikrolens_session";

interface SessionPayload {
  email: string;
  exp: number;
  userId: string;
}

export interface SessionIdentity {
  email: string;
  userId: string;
}

interface SessionCookieConfiguration {
  appUrl?: string;
  domain?: string;
  sameSite?: MikroLensSessionCookieSameSite;
}

export class SessionSecurity {
  readonly #appOrigin: string;
  readonly #cookieDomain: string;
  readonly #cookieSameSite: MikroLensSessionCookieSameSite;
  readonly #secret: string;
  readonly #ttlSeconds: number;

  constructor(
    secret = randomBytes(32).toString("hex"),
    ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
    cookieConfiguration: SessionCookieConfiguration = {},
  ) {
    this.#appOrigin = toOrigin(cookieConfiguration.appUrl);
    this.#cookieDomain = cookieConfiguration.domain?.trim() ?? "";
    this.#cookieSameSite = cookieConfiguration.sameSite ?? "auto";
    this.#secret = secret.trim() || randomBytes(32).toString("hex");
    this.#ttlSeconds = ttlSeconds;
  }

  clearSessionCookie(secure = false, requestOrigin = ""): string {
    const sameSite = this.resolveSameSite(requestOrigin);

    return serializeCookie(SESSION_COOKIE_NAME, "", {
      domain: this.#cookieDomain || undefined,
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite,
      secure: secure || sameSite === "None",
    });
  }

  createSessionCookie(
    user: Pick<UserDTO, "email" | "id">,
    secure = false,
    now = Date.now(),
    requestOrigin = "",
  ): string {
    const sameSite = this.resolveSameSite(requestOrigin);

    return serializeCookie(SESSION_COOKIE_NAME, this.issueSession(user, now), {
      domain: this.#cookieDomain || undefined,
      httpOnly: true,
      maxAge: this.#ttlSeconds,
      path: "/",
      sameSite,
      secure: secure || sameSite === "None",
    });
  }

  readSession(token: string, now = Date.now()): SessionIdentity | null {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature || !signaturesMatch(signature, this.sign(encodedPayload))) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as
        | SessionPayload
        | undefined;

      if (
        !payload ||
        typeof payload.userId !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.exp !== "number" ||
        payload.exp <= Math.floor(now / 1000)
      ) {
        return null;
      }

      return {
        email: payload.email,
        userId: payload.userId,
      };
    } catch {
      return null;
    }
  }

  readSessionFromCookie(
    cookieHeader: string | string[] | undefined,
    now = Date.now(),
  ): SessionIdentity | null {
    const token = parseCookie(cookieHeader)[SESSION_COOKIE_NAME];

    if (!token) {
      return null;
    }

    return this.readSession(token, now);
  }

  private issueSession(user: Pick<UserDTO, "email" | "id">, now = Date.now()): string {
    const payload = Buffer.from(
      JSON.stringify({
        email: user.email,
        exp: Math.floor(now / 1000) + this.#ttlSeconds,
        userId: user.id,
      } satisfies SessionPayload),
    ).toString("base64url");

    return `${payload}.${this.sign(payload)}`;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.#secret).update(value).digest("hex");
  }

  private resolveSameSite(requestOrigin: string): "Lax" | "None" | "Strict" {
    if (this.#cookieSameSite === "lax") {
      return "Lax";
    }

    if (this.#cookieSameSite === "strict") {
      return "Strict";
    }

    if (this.#cookieSameSite === "none") {
      return "None";
    }

    const requestApiOrigin = toOrigin(requestOrigin);

    if (
      this.#appOrigin &&
      requestApiOrigin &&
      !isSameSiteOrigin(this.#appOrigin, requestApiOrigin)
    ) {
      return "None";
    }

    return "Lax";
  }
}

function parseCookie(cookieHeader: string | string[] | undefined): Record<string, string> {
  const source = Array.isArray(cookieHeader) ? cookieHeader.join(";") : (cookieHeader ?? "");

  return source
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (name) {
        cookies[name] = decodeURIComponent(value);
      }

      return cookies;
    }, {});
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    domain?: string;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function toOrigin(value: string | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isSameSiteOrigin(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);

    if (leftUrl.protocol !== rightUrl.protocol) {
      return false;
    }

    if (leftUrl.hostname === rightUrl.hostname) {
      return true;
    }

    return isLoopbackHost(leftUrl.hostname) && isLoopbackHost(rightUrl.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
