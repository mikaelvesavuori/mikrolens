import type { OAuthProviderGateway, OAuthProviderPublicInfo } from "../../ports/OAuth.ts";

export interface OAuthProvidersPayload {
  count: number;
  providers: OAuthProviderPublicInfo[];
}

/**
 * @description List public OAuth provider metadata for the sign-in UI.
 */
export function listOAuthProviders(
  providers: Iterable<Pick<OAuthProviderGateway, "getPublicInfo">>,
): OAuthProvidersPayload {
  const items = Array.from(providers, (provider) => provider.getPublicInfo());

  return {
    count: items.length,
    providers: items,
  };
}
