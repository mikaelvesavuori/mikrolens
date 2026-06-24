import type { OAuthProviderGateway } from "../../application/ports/OAuth.ts";
import type { OAuthProviderConfig, OAuthTokens, OAuthUserInfo } from "./OAuthConfig.ts";

export class OAuthProvider implements OAuthProviderGateway {
  private readonly config: OAuthProviderConfig;

  constructor(config: OAuthProviderConfig) {
    this.config = config;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(this.config.tokenUrl, {
      body: body.toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        ...this.config.tokenHeaders,
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed with status ${response.status}.`);
    }

    return (await response.json()) as OAuthTokens;
  }

  async fetchUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...this.config.userInfoHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`User info fetch failed with status ${response.status}.`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async handleCallback(code: string): Promise<OAuthUserInfo> {
    const oauthTokens = await this.exchangeCodeForTokens(code);
    const providerUserInfo = await this.fetchUserInfo(oauthTokens.access_token);
    const user = this.mapUserInfo(providerUserInfo);

    if (!user.email) {
      throw new Error("OAuth provider did not return an email address.");
    }

    return user;
  }

  getAuthorizationUrl(state: string): string {
    const scopes = Array.isArray(this.config.scopes)
      ? this.config.scopes.join(" ")
      : this.config.scopes;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: scopes,
      state,
      ...this.config.authorizationParams,
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  getPublicInfo(): { id: string; loginUrl: string; name: string } {
    return {
      id: this.config.id,
      loginUrl: `/auth/oauth/${this.config.id}`,
      name: this.config.name,
    };
  }

  private mapUserInfo(providerUserInfo: Record<string, unknown>): OAuthUserInfo {
    if (this.config.userMapping) {
      return this.config.userMapping(providerUserInfo);
    }

    const email = typeof providerUserInfo.email === "string" ? providerUserInfo.email : "";
    const id =
      typeof providerUserInfo.sub === "string"
        ? providerUserInfo.sub
        : typeof providerUserInfo.id === "string" || typeof providerUserInfo.id === "number"
          ? String(providerUserInfo.id)
          : "";
    const name =
      typeof providerUserInfo.name === "string"
        ? providerUserInfo.name
        : typeof providerUserInfo.preferred_username === "string"
          ? providerUserInfo.preferred_username
          : undefined;
    const username =
      typeof providerUserInfo.preferred_username === "string"
        ? providerUserInfo.preferred_username
        : typeof providerUserInfo.username === "string"
          ? providerUserInfo.username
          : email
            ? email.split("@")[0]
            : undefined;

    return {
      email,
      id,
      name,
      username,
    };
  }
}
