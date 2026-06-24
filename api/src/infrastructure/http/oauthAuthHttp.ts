import type { IncomingMessage, ServerResponse } from "node:http";
import type { OAuthUserSignInRepository } from "../../application/ports/MikroLensRepository.ts";
import type { OAuthProviderGateway, OAuthSecurityGateway } from "../../application/ports/OAuth.ts";
import { completeOAuthSignIn } from "../../application/usecases/auth/completeOAuthSignIn.ts";
import { listOAuthProviders } from "../../application/usecases/auth/listOAuthProviders.ts";
import { startOAuthSignIn } from "../../application/usecases/auth/startOAuthSignIn.ts";
import type { UserDTO } from "../../domain/User.ts";
import type { MikroLensAuthGateway, MikroLensAuthTokenResponse } from "../auth/MikroLensAuth.ts";
import type { SessionSecurity } from "../security/SessionSecurity.ts";
import { getOAuthRequestContext, getOAuthRoute } from "./httpAdapters.ts";
import { getRequestOrigin, sendError, sendJson, sendRedirect } from "./httpUtils.ts";

export interface HandleOAuthAuthHttpOptions {
  auth: MikroLensAuthGateway;
  buildAuthRedirect: (status: "error" | "success", message: string, email?: string) => string;
  oauthProviders: ReadonlyMap<string, OAuthProviderGateway>;
  oauthSecurity: OAuthSecurityGateway | null;
  pathname: string;
  repository: OAuthUserSignInRepository;
  request: IncomingMessage;
  response: ServerResponse;
  sessionSecurity: SessionSecurity;
  url: URL;
}

/**
 * @description Handle OAuth HTTP transport and delegate the actual flow orchestration to auth use cases.
 */
export async function handleOAuthAuthHttp(options: HandleOAuthAuthHttpOptions): Promise<boolean> {
  const {
    auth,
    buildAuthRedirect,
    oauthProviders,
    oauthSecurity,
    pathname,
    repository,
    request,
    response,
    sessionSecurity,
    url,
  } = options;

  if (request.method === "GET" && pathname === "/auth/oauth/providers") {
    sendJson(response, 200, listOAuthProviders(oauthProviders.values()));
    return true;
  }

  if (request.method !== "GET" || !pathname.startsWith("/auth/oauth/")) {
    return false;
  }

  const oauthRoute = getOAuthRoute(pathname);

  if (!oauthRoute) {
    sendError(response, 404, "OAuth provider not found.");
    return true;
  }

  const requestContext = getOAuthRequestContext(request);

  if (oauthRoute.isCallback) {
    const result = await completeOAuthSignIn(
      repository,
      oauthProviders,
      oauthSecurity,
      oauthRoute.providerId,
      requestContext,
      {
        code: url.searchParams.get("code") ?? undefined,
        error: url.searchParams.get("error") ?? undefined,
        errorDescription: url.searchParams.get("error_description") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
      },
    );

    if (result.kind === "provider-not-found") {
      sendError(response, 404, "OAuth provider not found.");
      return true;
    }

    if (result.kind === "rate-limited") {
      sendJson(response, 429, {
        error: "Too many authentication attempts. Please try again later.",
        retryAfter: result.retryAfter,
      });
      return true;
    }

    const user =
      result.authStatus === "success" && result.email
        ? repository.getUserByEmail(result.email)
        : null;

    const redirectLocation =
      user && result.authStatus === "success"
        ? buildTokenRedirect(
            buildAuthRedirect(result.authStatus, result.message, result.email ?? ""),
            await issueTokensForUser(auth, user, request),
          )
        : buildAuthRedirect(result.authStatus, result.message, result.email ?? "");

    sendRedirect(
      response,
      redirectLocation,
      302,
      user
        ? {
            "Set-Cookie": sessionSecurity.createSessionCookie(
              user,
              isSecureRequest(request),
              Date.now(),
              getRequestOrigin(request, ""),
            ),
          }
        : {},
    );
    return true;
  }

  const result = startOAuthSignIn(
    oauthProviders,
    oauthSecurity,
    oauthRoute.providerId,
    requestContext,
  );

  if (result.kind === "provider-not-found") {
    sendError(response, 404, "OAuth provider not found.");
    return true;
  }

  if (result.kind === "rate-limited") {
    sendJson(response, 429, {
      error: "Too many authentication attempts. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return true;
  }

  sendRedirect(response, result.location);
  return true;
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

function isSecureRequest(request: IncomingMessage): boolean {
  const forwardedProto = Array.isArray(request.headers["x-forwarded-proto"])
    ? request.headers["x-forwarded-proto"][0]
    : request.headers["x-forwarded-proto"];

  if (typeof forwardedProto === "string") {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return Boolean((request.socket as { encrypted?: boolean }).encrypted);
}
