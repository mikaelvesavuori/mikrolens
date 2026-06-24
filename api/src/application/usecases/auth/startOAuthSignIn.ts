import type {
  OAuthProviderGateway,
  OAuthRequestContext,
  OAuthSecurityGateway,
} from "../../ports/OAuth.ts";

export type StartOAuthSignInResult =
  | {
      kind: "provider-not-found";
    }
  | {
      kind: "rate-limited";
      retryAfter: number;
    }
  | {
      kind: "authorization-redirect";
      location: string;
    };

/**
 * @description Start an OAuth sign-in by checking provider availability, rate limiting, and state generation.
 */
export function startOAuthSignIn(
  providers: ReadonlyMap<string, OAuthProviderGateway>,
  security: OAuthSecurityGateway | null,
  providerId: string,
  requestContext: OAuthRequestContext,
  now = Date.now(),
): StartOAuthSignInResult {
  const provider = providers.get(providerId);

  if (!provider || !security) {
    return {
      kind: "provider-not-found",
    };
  }

  const identifier = `oauth:${requestContext.ip}`;

  if (!security.checkRateLimit(identifier)) {
    const rateLimitInfo = security.getRateLimitInfo(identifier);

    return {
      kind: "rate-limited",
      retryAfter: Math.ceil((rateLimitInfo.reset - now) / 1000),
    };
  }

  const state = security.generateState(requestContext, providerId);

  return {
    kind: "authorization-redirect",
    location: provider.getAuthorizationUrl(state),
  };
}
