export interface OAuthRequestContext {
  ip: string;
  userAgent: string;
}

export interface OAuthCallbackInput {
  code?: string;
  error?: string;
  errorDescription?: string;
  state?: string;
}

export interface OAuthRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface OAuthCallbackValidationResult {
  code?: string;
  error?: string;
  valid: boolean;
}

export interface OAuthProviderPublicInfo {
  id: string;
  loginUrl: string;
  name: string;
}

export interface OAuthResolvedUser {
  email: string;
  id: string;
  name?: string;
  username?: string;
}

export interface OAuthProviderGateway {
  getAuthorizationUrl(state: string): string;
  getPublicInfo(): OAuthProviderPublicInfo;
  handleCallback(code: string): Promise<OAuthResolvedUser>;
}

export interface OAuthSecurityGateway {
  checkRateLimit(identifier: string): boolean;
  generateState(context: OAuthRequestContext, providerId: string): string;
  getRateLimitInfo(identifier: string): OAuthRateLimitInfo;
  validateCallback(
    context: OAuthRequestContext,
    providerId: string,
    callback: OAuthCallbackInput,
  ): OAuthCallbackValidationResult;
}
