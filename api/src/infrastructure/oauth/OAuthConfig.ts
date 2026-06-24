export interface OAuthProviderConfig {
  id: string;
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string | string[];
  userMapping?: (userInfo: Record<string, unknown>) => OAuthUserInfo;
  authorizationParams?: Record<string, string>;
  tokenHeaders?: Record<string, string>;
  userInfoHeaders?: Record<string, string>;
}

export interface OAuthPresetCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string | string[];
  authorizationParams?: Record<string, string>;
}

export interface OAuthConfiguration {
  presets?: {
    github?: OAuthPresetCredentials;
    gitlab?: OAuthPresetCredentials;
    google?: OAuthPresetCredentials;
    microsoft?: OAuthPresetCredentials;
  };
  custom?: OAuthProviderConfig[];
  stateExpirySeconds?: number;
  rateLimiting?: {
    maxAttempts?: number;
    windowMs?: number;
  };
}

export interface OAuthUserInfo {
  email: string;
  id: string;
  name?: string;
  username?: string;
}

export interface OAuthTokens {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export interface OAuthState {
  expires: number;
  ip: string;
  providerId: string;
  userAgent?: string;
}

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}
