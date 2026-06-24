import { fileURLToPath } from "node:url";
import { MikroAuth } from "mikroauth";
import type { MikroLensMailerMessage } from "../../src/application/ports/MikroLensMailer.ts";
import { MagicLinkService } from "../../src/application/services/MagicLinkService.ts";
import { SqliteMikroAuthStorageProvider } from "../../src/infrastructure/auth/SqliteMikroAuthStorageProvider.ts";
import { getSeedData } from "../../src/infrastructure/bootstrap/seedData.ts";
import { DocumentCollaborationHub } from "../../src/infrastructure/collaboration/DocumentCollaborationHub.ts";
import { MikroLensDatabase } from "../../src/infrastructure/database/MikroLensDatabase.ts";
import { AppServer } from "../../src/infrastructure/http/AppServer.ts";
import type {
  OAuthConfiguration,
  OAuthProviderConfig,
} from "../../src/infrastructure/oauth/OAuthConfig.ts";
import { OAuthProvider } from "../../src/infrastructure/oauth/OAuthProvider.ts";
import { SqliteMikroLensRepository } from "../../src/infrastructure/repositories/SqliteMikroLensRepository.ts";
import { OAuthSecurity } from "../../src/infrastructure/security/OAuthSecurity.ts";
import { SessionSecurity } from "../../src/infrastructure/security/SessionSecurity.ts";

/**
 * @description Create a fresh in-memory repository for each API test.
 */
export function createTestRepository(options: { seedDemoData?: boolean } = {}) {
  const database = new MikroLensDatabase(":memory:");
  database.migrate();
  database.seedHorizonDefaultsIfEmpty();

  if (options.seedDemoData ?? true) {
    database.seedDemoDataIfEmpty(getSeedData());
  }

  const repository = new SqliteMikroLensRepository(database);

  return {
    database,
    repository,
  };
}

class InMemoryMikroLensMailer {
  readonly messages: MikroLensMailerMessage[] = [];

  async send(message: MikroLensMailerMessage): Promise<void> {
    this.messages.push(message);
  }
}

/**
 * @description Create a running HTTP server backed by an in-memory repository.
 */
export async function createTestServer(
  options?: Partial<{
    allowedOrigins: string[];
    appUrl: string;
    demoLoginEnabled: boolean;
    oauth: OAuthConfiguration;
    oauthProviders: OAuthProviderConfig[];
    port: number;
    seedDemoData: boolean;
  }>,
) {
  const { database, repository } = createTestRepository({
    seedDemoData: options?.seedDemoData,
  });
  const staticRoot = fileURLToPath(new URL("../../../app/", import.meta.url));
  const mailer = new InMemoryMikroLensMailer();
  const oauthConfig = options?.oauth;
  const sessionSecurity = new SessionSecurity("test-session-secret", undefined, {
    appUrl: options?.appUrl,
  });
  const auth = new MikroAuth(
    {
      auth: {
        appUrl: options?.appUrl ?? "http://127.0.0.1",
        jwtExpirySeconds: 3600,
        jwtSecret: "test-mikrolens-auth-secret-with-enough-length",
        magicLinkExpirySeconds: 1800,
        maxActiveSessions: 5,
        refreshTokenExpirySeconds: 604800,
      },
      email: {
        emailSubject: "Sign in to MikroLens",
      },
    },
    undefined,
    new SqliteMikroAuthStorageProvider(database),
  );
  const server = new AppServer({
    allowedOrigins: options?.allowedOrigins,
    appUrl: options?.appUrl,
    auth,
    collaborationHub: new DocumentCollaborationHub(),
    demoLoginEnabled: options?.demoLoginEnabled ?? true,
    healthCheck: () => ({
      checks: {
        database: database.checkHealth() ? "up" : "down",
        staticFiles: "up",
      },
      status: database.checkHealth() ? "healthy" : "unhealthy",
    }),
    host: "127.0.0.1",
    magicLinkService: new MagicLinkService(repository, mailer),
    oauthProviders: (options?.oauthProviders ?? []).map((provider) => new OAuthProvider(provider)),
    oauthSecurity: oauthConfig ? new OAuthSecurity(oauthConfig) : undefined,
    port: options?.port ?? 0,
    repository,
    sessionSecurity,
    staticRoot,
  });

  await server.start();

  return {
    baseUrl: server.getBaseUrl(),
    close: async () => {
      await server.stop();
      database.close();
    },
    database,
    mailer,
    repository,
    auth,
    sessionSecurity,
    server,
  };
}
