import type { OAuthConfiguration, OAuthProviderConfig } from "./OAuthConfig.ts";
import { OAUTH_PRESETS } from "./OAuthPresets.ts";

export function resolveOAuthProviders(config?: OAuthConfiguration): OAuthProviderConfig[] {
  if (!config) {
    return [];
  }

  const providers: OAuthProviderConfig[] = [];

  if (config.presets) {
    for (const [presetName, credentials] of Object.entries(config.presets)) {
      if (!credentials) {
        continue;
      }

      const preset = OAUTH_PRESETS[presetName];

      if (!preset) {
        console.warn(`[OAuth] Unknown preset provider: ${presetName}`);
        continue;
      }

      providers.push({
        ...preset,
        authorizationParams: {
          ...preset.authorizationParams,
          ...credentials.authorizationParams,
        },
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        redirectUri: credentials.redirectUri,
        scopes: credentials.scopes || preset.scopes,
      });
    }
  }

  if (config.custom) {
    providers.push(...config.custom);
  }

  return providers;
}
