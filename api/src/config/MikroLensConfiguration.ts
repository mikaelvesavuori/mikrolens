import type { UserRole } from "../domain/User.ts";
import type { OAuthConfiguration } from "../infrastructure/oauth/OAuthConfig.ts";

export type MikroLensSessionCookieSameSite = "auto" | "lax" | "none" | "strict";

export interface MikroLensConfiguration {
  auth: {
    appUrl: string;
    initialUser: {
      email: string;
      name: string;
      role: UserRole;
    };
    jwtExpirySeconds: number;
    jwtSecret: string;
    magicLinkExpiryMinutes: number;
    maxActiveSessions: number;
    refreshTokenExpirySeconds: number;
    sessionCookieDomain: string;
    sessionCookieSameSite: MikroLensSessionCookieSameSite;
    sessionSecret: string;
  };
  demo: {
    loginEnabled: boolean;
    seedOnEmpty: boolean;
  };
  email: {
    debug: boolean;
    emailSubject: string;
    host: string;
    maxRetries: number;
    password: string;
    port: number;
    secure: boolean;
    user: string;
  };
  oauth?: OAuthConfiguration;
  server: {
    allowedOrigins: string[];
    host: string;
    port: number;
    staticRoot: string;
  };
  storage: {
    databasePath: string;
  };
  webhooks: {
    batchSize: number;
    concurrency: number;
    maxAttempts: number;
    pollIntervalMs: number;
    requestTimeoutMs: number;
    staleClaimTimeoutMs: number;
    workerId: string;
  };
}
