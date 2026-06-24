import type { IncomingMessage, ServerResponse } from "node:http";
import type { UserRepository } from "../../application/ports/MikroLensRepository.ts";
import type { MagicLinkService } from "../../application/services/MagicLinkService.ts";
import { recordUserSignIn } from "../../application/usecases/auth/recordUserSignIn.ts";
import { publicUserPermissions } from "../../domain/Authorization.ts";
import type { UserDTO } from "../../domain/User.ts";
import { RateLimitError } from "../../errors/MikroLensError.ts";
import type { MikroLensAuthGateway, MikroLensAuthTokenResponse } from "../auth/MikroLensAuth.ts";
import type { RateLimiter } from "../security/RateLimiter.ts";
import type { SessionSecurity } from "../security/SessionSecurity.ts";
import {
  getRequestOrigin,
  readJsonBody,
  sendError,
  sendJson,
  sendNoContent,
  sendRedirect,
} from "./httpUtils.ts";
import { requestMagicLinkSignInFromInput } from "./inputs/requestMagicLinkSignInFromInput.ts";
import { verifyMagicLinkSignInFromInput } from "./inputs/verifyMagicLinkSignInFromInput.ts";

export interface HandleMagicLinkAuthHttpOptions {
  apiUrl: string;
  appUrl: string;
  auth: MikroLensAuthGateway;
  buildAuthRedirect: (status: "error" | "success", message: string, email?: string) => string;
  currentUser: UserDTO | null;
  demoLoginEnabled: boolean;
  magicLinkService: Pick<MagicLinkService, "sendSignInLink" | "verify">;
  pathname: string;
  rateLimiter?: RateLimiter;
  repository: Pick<UserRepository, "getUser" | "listUsers" | "saveUser">;
  request: IncomingMessage;
  response: ServerResponse;
  sessionSecurity: SessionSecurity;
  url: URL;
}

/**
 * @description Handle passwordless sign-in HTTP routes outside the main server router.
 */
export async function handleMagicLinkAuthHttp(
  options: HandleMagicLinkAuthHttpOptions,
): Promise<boolean> {
  const {
    apiUrl,
    appUrl,
    auth,
    buildAuthRedirect,
    currentUser,
    demoLoginEnabled,
    magicLinkService,
    pathname,
    rateLimiter,
    repository,
    request,
    response,
    sessionSecurity,
    url,
  } = options;
  const secureCookie = isSecureRequest(request);
  const requestOrigin = getRequestOrigin(request, apiUrl);

  if (request.method === "GET" && pathname === "/auth/session") {
    if (!currentUser) {
      sendError(response, 401, "Sign in is required.");
      return true;
    }

    sendJson(response, 200, {
      user: {
        email: currentUser.email,
        id: currentUser.id,
        permissions: publicUserPermissions(currentUser),
        role: currentUser.role,
      },
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/logout") {
    const body = await readJsonBody<{ refreshToken?: string }>(request);

    if (body.refreshToken?.trim()) {
      await auth.logout(body.refreshToken.trim());
    }

    sendNoContent(response, {
      "Set-Cookie": sessionSecurity.clearSessionCookie(secureCookie, requestOrigin),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/refresh") {
    const body = await readJsonBody<{ refreshToken?: string }>(request);
    const refreshToken = body.refreshToken?.trim() ?? "";
    enforceAuthRateLimit(rateLimiter, {
      key: `refresh:ip:${getClientIp(request)}`,
      limit: 60,
      message: "Too many refresh attempts. Please try again later.",
      windowMs: 60_000,
    });

    if (!refreshToken) {
      sendError(response, 400, "Refresh token is required.");
      return true;
    }

    try {
      sendJson(response, 200, await auth.refreshAccessToken(refreshToken));
    } catch {
      sendError(response, 401, "Refresh token is invalid or expired.");
    }

    return true;
  }

  if (request.method === "POST" && pathname === "/auth/login") {
    const body = await readJsonBody<{ email?: string }>(request);
    const normalizedEmail = String(body.email ?? "")
      .trim()
      .toLowerCase();

    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link:ip:${getClientIp(request)}`,
      limit: 20,
      message: "Too many sign-in attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });
    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link:email:${normalizedEmail || "missing"}`,
      limit: 5,
      message: "Too many sign-in attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });

    sendJson(response, 200, await requestMagicLinkSignInFromInput(magicLinkService, appUrl, body));

    return true;
  }

  if (request.method === "GET" && pathname === "/auth/metadata") {
    const hasUsers = repository.listUsers().length > 0;

    sendJson(response, 200, {
      authenticationRequired: true,
      demoLoginEnabled: demoLoginEnabled && hasUsers,
      hasUsers,
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/auth/demo-users") {
    if (!demoLoginEnabled) {
      sendJson(response, 200, {
        count: 0,
        users: [],
      });
      return true;
    }

    const users = repository
      .listUsers()
      .toSorted((left, right) => {
        const leftName = String(left.name ?? left.email)
          .trim()
          .toLowerCase();
        const rightName = String(right.name ?? right.email)
          .trim()
          .toLowerCase();

        return leftName.localeCompare(rightName) || left.email.localeCompare(right.email);
      })
      .map((user) => ({
        email: user.email,
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      }));

    sendJson(response, 200, {
      count: users.length,
      users,
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/demo-login") {
    if (!demoLoginEnabled) {
      sendError(response, 404, "Demo sign-in is not enabled.");
      return true;
    }

    const body = await readJsonBody<{ userId?: string }>(request);
    const userId = String(body.userId ?? "").trim();

    if (!userId) {
      sendError(response, 400, "Choose a demo user to continue.");
      return true;
    }

    const user = repository.getUser(userId);

    if (!user) {
      sendError(response, 404, "Demo user not found.");
      return true;
    }

    const signedInUser = recordUserSignIn(repository, user);
    const tokens = await issueTokensForUser(auth, signedInUser, request);

    sendJson(
      response,
      200,
      {
        ...tokens,
        message: "Demo user signed in.",
        user: {
          email: signedInUser.email,
          id: signedInUser.id,
          permissions: publicUserPermissions(signedInUser),
          role: signedInUser.role,
        },
      },
      {
        "Set-Cookie": sessionSecurity.createSessionCookie(
          signedInUser,
          secureCookie,
          Date.now(),
          requestOrigin,
        ),
      },
    );
    return true;
  }

  if (pathname !== "/auth/verify") {
    return false;
  }

  const token = url.searchParams.get("token") ?? "";
  const email = url.searchParams.get("email") ?? "";

  if (request.method === "GET") {
    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link-verify:ip:${getClientIp(request)}`,
      limit: 30,
      message: "Too many sign-in link verification attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });
    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link-verify:email:${email.trim().toLowerCase() || "missing"}`,
      limit: 10,
      message: "Too many sign-in link verification attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });

    if (!token || !email) {
      sendRedirect(response, buildAuthRedirect("error", "Sign-in link is incomplete."));
      return true;
    }

    try {
      const user = magicLinkService.verify(token, email);
      const tokens = await issueTokensForUser(auth, user, request);
      sendRedirect(
        response,
        buildTokenRedirect(buildAuthRedirect("success", "", user.email), tokens),
        302,
        {
          "Set-Cookie": sessionSecurity.createSessionCookie(
            user,
            secureCookie,
            Date.now(),
            requestOrigin,
          ),
        },
      );
    } catch (error) {
      sendRedirect(
        response,
        buildAuthRedirect(
          "error",
          error instanceof Error ? error.message : "Sign-in link could not be verified.",
        ),
      );
    }

    return true;
  }

  if (request.method === "POST") {
    const body = await readJsonBody<{ email?: string; token?: string }>(request);
    const normalizedEmail = (body.email?.trim() || email).toLowerCase();

    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link-verify:ip:${getClientIp(request)}`,
      limit: 30,
      message: "Too many sign-in link verification attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });
    enforceAuthRateLimit(rateLimiter, {
      key: `magic-link-verify:email:${normalizedEmail || "missing"}`,
      limit: 10,
      message: "Too many sign-in link verification attempts. Please try again later.",
      windowMs: 15 * 60_000,
    });

    const verifiedUser = verifyMagicLinkSignInFromInput(magicLinkService, {
      email: body.email?.trim() || email,
      token: body.token?.trim() || token,
    });
    const tokens = await issueTokensForUser(auth, verifiedUser, request);

    sendJson(
      response,
      200,
      {
        ...tokens,
        message: "Sign-in link verified.",
        user: {
          email: verifiedUser.email,
          id: verifiedUser.id,
          permissions: publicUserPermissions(verifiedUser),
          role: verifiedUser.role,
        },
      },
      {
        "Set-Cookie": sessionSecurity.createSessionCookie(
          verifiedUser,
          secureCookie,
          Date.now(),
          requestOrigin,
        ),
      },
    );

    return true;
  }

  return false;
}

async function issueTokensForUser(
  auth: MikroLensAuthGateway,
  user: UserDTO,
  request: IncomingMessage,
): Promise<MikroLensAuthTokenResponse> {
  return auth.createToken({
    email: user.email,
    ip: getClientIp(request),
    role: user.role,
    username: user.name ?? user.email,
  });
}

function buildTokenRedirect(location: string, tokens: MikroLensAuthTokenResponse): string {
  const url = new URL(location);
  url.searchParams.set("access_token", tokens.accessToken);
  url.searchParams.set("refresh_token", tokens.refreshToken);
  url.searchParams.set("expires_in", String(tokens.exp));
  url.searchParams.set("token_type", tokens.tokenType);
  return url.toString();
}

function getClientIp(request: IncomingMessage): string {
  const forwardedFor = Array.isArray(request.headers["x-forwarded-for"])
    ? request.headers["x-forwarded-for"][0]
    : request.headers["x-forwarded-for"];

  return forwardedFor?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
}

function enforceAuthRateLimit(
  rateLimiter: RateLimiter | undefined,
  options: {
    key: string;
    limit: number;
    message: string;
    windowMs: number;
  },
): void {
  if (!rateLimiter) {
    return;
  }

  const result = rateLimiter.check({
    key: options.key,
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!result.allowed) {
    throw new RateLimitError(options.message, result.retryAfterSeconds);
  }
}

function isSecureRequest(request: IncomingMessage): boolean {
  const forwardedProto = Array.isArray(request.headers["x-forwarded-proto"])
    ? request.headers["x-forwarded-proto"][0]
    : request.headers["x-forwarded-proto"];

  if (typeof forwardedProto === "string") {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return Boolean((request.socket as { encrypted?: boolean }).encrypted);
}
