import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getMikroLensConfig } from "../../src/config/mikrolensOptions.ts";

describe("getMikroLensConfig", () => {
  it("merges defaults, config file values, and CLI overrides", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mikrolens-config-"));
    const configFilePath = join(directory, "mikrolens.config.json");

    try {
      await writeFile(
        configFilePath,
        JSON.stringify({
          auth: {
            appUrl: "https://mikrolens.example.com",
            initialUser: {
              email: "owner@example.com",
              name: "Owner",
            },
            magicLinkExpiryMinutes: 45,
            sessionCookieSameSite: "none",
          },
          email: {
            emailSubject: "Open MikroLens",
          },
          oauth: {
            custom: [
              {
                authorizationUrl: "https://auth.example.com/oauth/authorize",
                clientId: "client-id",
                clientSecret: "client-secret",
                id: "acme",
                name: "Acme SSO",
                redirectUri: "https://mikrolens.example.com/auth/oauth/acme/callback",
                scopes: "openid email profile",
                tokenUrl: "https://auth.example.com/oauth/token",
                userInfoUrl: "https://auth.example.com/oauth/userinfo",
              },
            ],
          },
          server: {
            allowedOrigins: ["https://preview.mikrolens.example.com"],
            host: "0.0.0.0",
            port: 4567,
          },
        }),
      );

      const config = getMikroLensConfig({
        args: [
          "node",
          "server.ts",
          "--port",
          "9999",
          "--initial-user-email",
          "admin@example.com",
          "--email-subject",
          "Sign in please",
        ],
        configFilePath,
      });

      expect(config.server.host).toBe("0.0.0.0");
      expect(config.server.port).toBe(9999);
      expect(config.server.allowedOrigins).toEqual(["https://preview.mikrolens.example.com"]);
      expect(config.auth.appUrl).toBe("https://mikrolens.example.com");
      expect(config.auth.initialUser.email).toBe("admin@example.com");
      expect(config.auth.initialUser.name).toBe("Owner");
      expect(config.auth.initialUser.role).toBe("Admin");
      expect(config.auth.magicLinkExpiryMinutes).toBe(45);
      expect(config.auth.sessionCookieSameSite).toBe("none");
      expect(config.email.emailSubject).toBe("Sign in please");
      expect("from" in (config.email as unknown as Record<string, unknown>)).toBe(false);
      expect(config.oauth?.custom?.[0]?.id).toBe("acme");
      expect(config.storage.databasePath).toContain("mikrolens.sqlite");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
