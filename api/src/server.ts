import { existsSync } from "node:fs";
import { MikroAuth } from "mikroauth";
import { MagicLinkService } from "./application/services/MagicLinkService.ts";
import type { MikroLensConfiguration } from "./config/MikroLensConfiguration.ts";
import { getMikroLensConfig } from "./config/mikrolensOptions.ts";
import { SqliteMikroAuthStorageProvider } from "./infrastructure/auth/SqliteMikroAuthStorageProvider.ts";
import { seedInitialUserIfEmpty } from "./infrastructure/bootstrap/initialUser.ts";
import { getSeedData } from "./infrastructure/bootstrap/seedData.ts";
import { DocumentCollaborationHub } from "./infrastructure/collaboration/DocumentCollaborationHub.ts";
import { MikroLensDatabase } from "./infrastructure/database/MikroLensDatabase.ts";
import { ConsoleMikroLensMailer } from "./infrastructure/email/ConsoleMikroLensMailer.ts";
import { MikroMailMikroLensMailer } from "./infrastructure/email/MikroMailMikroLensMailer.ts";
import { AppServer } from "./infrastructure/http/AppServer.ts";
import { OAuthProvider } from "./infrastructure/oauth/OAuthProvider.ts";
import { resolveOAuthProviders } from "./infrastructure/oauth/OAuthProviderResolver.ts";
import { SqliteMikroLensRepository } from "./infrastructure/repositories/SqliteMikroLensRepository.ts";
import { OAuthSecurity } from "./infrastructure/security/OAuthSecurity.ts";
import { SessionSecurity } from "./infrastructure/security/SessionSecurity.ts";

const config = getMikroLensConfig();
const { host, port, staticRoot } = config.server;
const oauthSecurity = config.oauth ? new OAuthSecurity(config.oauth) : null;
const resolvedAllowedOrigins = resolveAllowedOrigins(config);
const sessionSecurity = new SessionSecurity(config.auth.sessionSecret, undefined, {
  appUrl: config.auth.appUrl,
  domain: config.auth.sessionCookieDomain,
  sameSite: config.auth.sessionCookieSameSite,
});
const oauthProviders = resolveOAuthProviders(config.oauth).map(
  (providerConfig) => new OAuthProvider(providerConfig),
);

const database = new MikroLensDatabase(config.storage.databasePath);
database.migrate();
database.seedHorizonDefaultsIfEmpty();

if (config.demo.seedOnEmpty) {
  database.seedDemoDataIfEmpty(getSeedData());
}

const repository = new SqliteMikroLensRepository(database);
const initialUser = seedInitialUserIfEmpty(repository, config.auth.initialUser);

if (initialUser) {
  console.log(
    `Created initial MikroLens ${initialUser.role.toLowerCase()} user ${initialUser.email}.`,
  );
}

const auth = new MikroAuth(
  {
    auth: {
      appUrl: config.auth.appUrl,
      jwtExpirySeconds: config.auth.jwtExpirySeconds,
      jwtSecret: config.auth.jwtSecret,
      magicLinkExpirySeconds: config.auth.magicLinkExpiryMinutes * 60,
      maxActiveSessions: config.auth.maxActiveSessions,
      refreshTokenExpirySeconds: config.auth.refreshTokenExpirySeconds,
    },
    email: {
      debug: config.email.debug,
      emailSubject: config.email.emailSubject,
      host: config.email.host,
      maxRetries: config.email.maxRetries,
      password: config.email.password,
      port: config.email.port,
      secure: config.email.secure,
      user: config.email.user,
    },
  },
  undefined,
  new SqliteMikroAuthStorageProvider(database),
);
const mailer = createMailer(config.email);
const collaborationHub = new DocumentCollaborationHub();
const magicLinkService = new MagicLinkService(
  repository,
  mailer,
  config.auth.magicLinkExpiryMinutes,
  config.email.emailSubject,
);
const server = new AppServer({
  appUrl: config.auth.appUrl,
  allowedOrigins: resolvedAllowedOrigins,
  auth,
  collaborationHub,
  healthCheck: () => {
    const databaseHealthy = database.checkHealth();
    const staticFilesHealthy = existsSync(staticRoot);

    return {
      checks: {
        database: databaseHealthy ? "up" : "down",
        staticFiles: staticFilesHealthy ? "up" : "missing",
      },
      details: {
        oauthProviders: oauthProviders.map((provider) => provider.getPublicInfo().id),
        webhookWorkerConfigured: Boolean(config.webhooks.workerId.trim()),
      },
      status: databaseHealthy && staticFilesHealthy ? "healthy" : "unhealthy",
    };
  },
  host,
  demoLoginEnabled: config.demo.loginEnabled,
  magicLinkService,
  oauthProviders,
  oauthSecurity: oauthSecurity ?? undefined,
  port,
  repository,
  sessionSecurity,
  staticRoot,
});

try {
  await server.start();
} catch (error) {
  database.close();

  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(
      `MikroLens could not start because ${host}:${port} is already in use. Stop the existing process or start with a different port, for example PORT=4322 npm run dev.`,
    );
    process.exit(1);
  }

  throw error;
}

console.log(`MikroLens is running at ${server.getBaseUrl()}`);

async function shutdown(exitCode: number) {
  try {
    await server.stop();
  } catch (error) {
    console.error("MikroLens did not shut down cleanly.", error);
    exitCode = 1;
  } finally {
    database.close();
    process.exit(exitCode);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(0);
  });
}

function createMailer(config: MikroLensConfiguration["email"]) {
  const hostValue = config.host.trim();
  const passwordValue = config.password.trim();
  const userValue = config.user.trim();
  const configuredFields = [hostValue, passwordValue, userValue].filter(Boolean).length;

  if (configuredFields > 0 && configuredFields < 3) {
    throw new Error(
      "MikroLens email configuration is incomplete. Set email.host, email.user, and email.password together to enable MikroMail SMTP delivery.",
    );
  }

  if (hostValue && passwordValue && userValue) {
    console.log(
      `MikroLens email delivery is enabled via MikroMail SMTP (${hostValue}:${config.port}).`,
    );

    return new MikroMailMikroLensMailer({
      debug: config.debug,
      host: hostValue,
      maxRetries: config.maxRetries,
      password: passwordValue,
      port: config.port,
      secure: config.secure,
      user: userValue,
    });
  }

  console.warn(
    "MikroLens email delivery is using console delivery. Magic links and invitations will be logged to the terminal until SMTP is configured.",
  );

  return new ConsoleMikroLensMailer();
}

function resolveAllowedOrigins(config: MikroLensConfiguration): string[] {
  const configuredOrigins = new Set(
    config.server.allowedOrigins.map(normalizeOrigin).filter(Boolean),
  );
  const appOrigin = normalizeOrigin(config.auth.appUrl);

  if (appOrigin) {
    configuredOrigins.add(appOrigin);
  }

  return [...configuredOrigins];
}

function normalizeOrigin(value: string): string {
  if (!value.trim()) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
