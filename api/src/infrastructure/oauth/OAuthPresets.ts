import type { OAuthProviderConfig, OAuthUserInfo } from "./OAuthConfig.ts";

export const OAUTH_PRESETS: Record<
  string,
  Omit<OAuthProviderConfig, "clientId" | "clientSecret" | "redirectUri">
> = {
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    id: "github",
    name: "GitHub",
    scopes: "user:email read:user",
    tokenHeaders: {
      Accept: "application/json",
    },
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoHeaders: {
      Accept: "application/vnd.github.v3+json",
    },
    userInfoUrl: "https://api.github.com/user",
    userMapping: (userInfo): OAuthUserInfo => ({
      email: typeof userInfo.email === "string" ? userInfo.email : "",
      id:
        typeof userInfo.id === "number" || typeof userInfo.id === "string"
          ? String(userInfo.id)
          : "",
      name:
        typeof userInfo.name === "string"
          ? userInfo.name
          : typeof userInfo.login === "string"
            ? userInfo.login
            : undefined,
      username: typeof userInfo.login === "string" ? userInfo.login : undefined,
    }),
  },
  gitlab: {
    authorizationUrl: "https://gitlab.com/oauth/authorize",
    id: "gitlab",
    name: "GitLab",
    scopes: "read_user email",
    tokenUrl: "https://gitlab.com/oauth/token",
    userInfoUrl: "https://gitlab.com/api/v4/user",
    userMapping: (userInfo): OAuthUserInfo => ({
      email: typeof userInfo.email === "string" ? userInfo.email : "",
      id:
        typeof userInfo.id === "number" || typeof userInfo.id === "string"
          ? String(userInfo.id)
          : "",
      name: typeof userInfo.name === "string" ? userInfo.name : undefined,
      username: typeof userInfo.username === "string" ? userInfo.username : undefined,
    }),
  },
  google: {
    authorizationParams: {
      access_type: "offline",
      prompt: "consent",
    },
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    id: "google",
    name: "Google",
    scopes: "openid email profile",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    userMapping: (userInfo): OAuthUserInfo => ({
      email: typeof userInfo.email === "string" ? userInfo.email : "",
      id:
        typeof userInfo.sub === "string"
          ? userInfo.sub
          : typeof userInfo.id === "string"
            ? userInfo.id
            : "",
      name: typeof userInfo.name === "string" ? userInfo.name : undefined,
      username: typeof userInfo.email === "string" ? userInfo.email.split("@")[0] : undefined,
    }),
  },
  microsoft: {
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    id: "microsoft",
    name: "Microsoft",
    scopes: "openid email profile User.Read",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    userMapping: (userInfo): OAuthUserInfo => ({
      email:
        typeof userInfo.mail === "string"
          ? userInfo.mail
          : typeof userInfo.userPrincipalName === "string"
            ? userInfo.userPrincipalName
            : "",
      id: typeof userInfo.id === "string" ? userInfo.id : "",
      name: typeof userInfo.displayName === "string" ? userInfo.displayName : undefined,
      username:
        typeof userInfo.userPrincipalName === "string"
          ? userInfo.userPrincipalName.split("@")[0]
          : undefined,
    }),
  },
};
