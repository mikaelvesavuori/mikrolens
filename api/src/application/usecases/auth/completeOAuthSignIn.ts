import type { OAuthUserSignInRepository } from "../../ports/MikroLensRepository.ts";
import type {
  OAuthCallbackInput,
  OAuthProviderGateway,
  OAuthRequestContext,
  OAuthSecurityGateway,
} from "../../ports/OAuth.ts";
import { signInUserFromOAuth } from "./signInUserFromOAuth.ts";

export type CompleteOAuthSignInResult =
  | {
      kind: "provider-not-found";
    }
  | {
      kind: "rate-limited";
      retryAfter: number;
    }
  | {
      authStatus: "error" | "success";
      email?: string;
      kind: "app-redirect";
      message: string;
    };

/**
 * @description Complete an OAuth callback by validating state, resolving the provider user, and signing them in.
 */
export async function completeOAuthSignIn(
  repository: OAuthUserSignInRepository,
  providers: ReadonlyMap<string, OAuthProviderGateway>,
  security: OAuthSecurityGateway | null,
  providerId: string,
  requestContext: OAuthRequestContext,
  callback: OAuthCallbackInput,
  now = Date.now(),
): Promise<CompleteOAuthSignInResult> {
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

  const validation = security.validateCallback(requestContext, providerId, callback);

  if (!validation.valid || !validation.code) {
    return {
      authStatus: "error",
      kind: "app-redirect",
      message: validation.error ?? "OAuth sign-in failed.",
    };
  }

  try {
    const oauthUser = await provider.handleCallback(validation.code);
    const signedInUser = signInUserFromOAuth(repository, oauthUser.email);

    return {
      authStatus: "success",
      email: signedInUser.email,
      kind: "app-redirect",
      message: "",
    };
  } catch (error) {
    return {
      authStatus: "error",
      kind: "app-redirect",
      message: error instanceof Error ? error.message : "OAuth sign-in failed.",
    };
  }
}
