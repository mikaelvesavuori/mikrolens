import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MikroLensSessionCookieSameSite } from "./MikroLensConfiguration.ts";

const defaultSessionSecret =
  process.env.MIKROLENS_SESSION_SECRET?.trim() || randomBytes(32).toString("hex");
const defaultJwtSecret =
  process.env.MIKROLENS_AUTH_JWT_SECRET?.trim() ||
  process.env.MIKROLENS_SESSION_SECRET?.trim() ||
  randomBytes(32).toString("hex");

export function configDefaults() {
  return {
    auth: {
      appUrl: process.env.MIKROLENS_APP_URL?.trim() ?? "",
      initialUser: {
        email: process.env.MIKROLENS_INITIAL_USER_EMAIL?.trim() ?? "",
        name: process.env.MIKROLENS_INITIAL_USER_NAME?.trim() ?? "",
        role: resolveInitialUserRole(process.env.MIKROLENS_INITIAL_USER_ROLE),
      },
      jwtExpirySeconds: Number(process.env.MIKROLENS_AUTH_JWT_EXPIRY_SECONDS ?? "3600"),
      jwtSecret: defaultJwtSecret,
      magicLinkExpiryMinutes: Number(process.env.MIKROLENS_MAGIC_LINK_EXPIRY_MINUTES ?? "30"),
      maxActiveSessions: Number(process.env.MIKROLENS_AUTH_MAX_ACTIVE_SESSIONS ?? "5"),
      refreshTokenExpirySeconds: Number(
        process.env.MIKROLENS_AUTH_REFRESH_TOKEN_EXPIRY_SECONDS ?? "604800",
      ),
      sessionCookieDomain: process.env.MIKROLENS_SESSION_COOKIE_DOMAIN?.trim() ?? "",
      sessionCookieSameSite: resolveSessionCookieSameSite(
        process.env.MIKROLENS_SESSION_COOKIE_SAME_SITE,
      ),
      sessionSecret: defaultSessionSecret,
    },
    demo: {
      loginEnabled: parseBoolean(process.env.MIKROLENS_DEMO_LOGIN_ENABLED),
      seedOnEmpty: parseBoolean(process.env.MIKROLENS_SEED_DEMO_DATA),
    },
    email: {
      debug: parseBoolean(process.env.MIKROLENS_EMAIL_DEBUG),
      emailSubject: process.env.MIKROLENS_EMAIL_SUBJECT?.trim() || "Sign in to MikroLens",
      host: process.env.MIKROLENS_EMAIL_HOST?.trim() ?? "",
      maxRetries: Number(process.env.MIKROLENS_EMAIL_MAX_RETRIES ?? "2"),
      password: process.env.MIKROLENS_EMAIL_PASSWORD?.trim() ?? "",
      port: Number(process.env.MIKROLENS_EMAIL_PORT ?? "465"),
      secure: parseBoolean(process.env.MIKROLENS_EMAIL_SECURE, true),
      user: process.env.MIKROLENS_EMAIL_USER?.trim() ?? "",
    },
    server: {
      allowedOrigins: parseAllowedOrigins(process.env.MIKROLENS_ALLOWED_ORIGINS),
      host: process.env.HOST ?? "127.0.0.1",
      port: Number(process.env.PORT ?? "3000"),
      staticRoot: resolveStaticRoot(),
    },
    storage: {
      databasePath:
        process.env.MIKROLENS_DB_PATH ??
        fileURLToPath(new URL("../../data/mikrolens.sqlite", import.meta.url)),
    },
    webhooks: {
      batchSize: Number(process.env.MIKROLENS_WEBHOOK_BATCH_SIZE ?? "10"),
      concurrency: Number(process.env.MIKROLENS_WEBHOOK_CONCURRENCY ?? "5"),
      maxAttempts: Number(process.env.MIKROLENS_WEBHOOK_MAX_ATTEMPTS ?? "6"),
      pollIntervalMs: Number(process.env.MIKROLENS_WEBHOOK_POLL_INTERVAL_MS ?? "1000"),
      requestTimeoutMs: Number(process.env.MIKROLENS_WEBHOOK_TIMEOUT_MS ?? "5000"),
      staleClaimTimeoutMs: Number(process.env.MIKROLENS_WEBHOOK_STALE_CLAIM_MS ?? "60000"),
      workerId: process.env.MIKROLENS_WEBHOOK_WORKER_ID ?? "",
    },
  };
}

function resolveInitialUserRole(value: string | undefined): "Admin" | "User" {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "user") {
    return "User";
  }

  return "Admin";
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveSessionCookieSameSite(value: string | undefined): MikroLensSessionCookieSameSite {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "lax" ||
    normalized === "none" ||
    normalized === "strict" ||
    normalized === "auto"
  ) {
    return normalized;
  }

  return "auto";
}

function resolveStaticRoot(): string {
  if (process.env.MIKROLENS_STATIC_ROOT) {
    return process.env.MIKROLENS_STATIC_ROOT;
  }

  const candidates = [
    fileURLToPath(new URL("../app/", import.meta.url)),
    fileURLToPath(new URL("../../app/", import.meta.url)),
    fileURLToPath(new URL("../../../app/", import.meta.url)),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates.at(-1) ?? "app";
}
