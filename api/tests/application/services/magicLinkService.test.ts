import type { MikroLensMailerMessage } from "../../../src/application/ports/MikroLensMailer.ts";
import {
  hashMagicLinkToken,
  MagicLinkService,
} from "../../../src/application/services/MagicLinkService.ts";
import { User } from "../../../src/domain/User.ts";
import { createTestRepository } from "../../support/testUtils.ts";

describe("MagicLinkService", () => {
  it("returns the generic sign-in response when no account matches", async () => {
    const { database, repository } = createTestRepository();
    const mailer = new CapturingMailer();
    const service = new MagicLinkService(repository, mailer, 30);

    try {
      await expect(
        service.sendSignInLink("missing.person@example.com", "http://localhost:3000"),
      ).resolves.toEqual({
        message: "If this email can sign in, you will receive a sign-in link shortly.",
      });
      expect(mailer.messages).toEqual([]);
      expect(countMagicLinks(database)).toBe(0);
    } finally {
      database.close();
    }
  });

  it("creates one-time sign-in links and marks them used after verification", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const { database, repository } = createTestRepository();
    const mailer = new CapturingMailer();
    const service = new MagicLinkService(repository, mailer, 30);
    const user = createUser("user_magic_link_signin", "sam.person@example.com");

    repository.saveUser(user);

    try {
      await service.sendSignInLink(user.email, "http://localhost:3000");

      const token = extractMagicLinkToken(mailer.messages[0]);
      const storedLink = repository.getMagicLinkByTokenHash(hashMagicLinkToken(token));

      expect(storedLink?.usedAt).toBeNull();

      const signedIn = service.verify(token, user.email);

      expect(signedIn.status).toBe("Active");
      expect(signedIn.activatedAt).toBe("2024-01-01T00:00:00.000Z");
      expect(repository.getMagicLinkByTokenHash(hashMagicLinkToken(token))?.usedAt).toBe(
        "2024-01-01T00:00:00.000Z",
      );
      expect(() => service.verify(token, user.email)).toThrow(
        "This sign-in link has already been used.",
      );
    } finally {
      database.close();
      vi.useRealTimers();
    }
  });

  it("revokes earlier active links when a new sign-in email is sent", async () => {
    const { database, repository } = createTestRepository();
    const mailer = new CapturingMailer();
    const service = new MagicLinkService(repository, mailer, 30);
    const user = createUser("user_magic_link_reissue", "alex.person@example.com");

    repository.saveUser(user);

    try {
      await service.sendSignInLink(user.email, "http://localhost:3000");
      const firstToken = extractMagicLinkToken(mailer.messages[0]);

      await service.sendSignInLink(user.email, "http://localhost:3000");
      const secondToken = extractMagicLinkToken(mailer.messages[1]);

      expect(repository.getMagicLinkByTokenHash(hashMagicLinkToken(firstToken))?.usedAt).toEqual(
        expect.any(String),
      );
      expect(
        repository.getMagicLinkByTokenHash(hashMagicLinkToken(secondToken))?.usedAt,
      ).toBeNull();
      expect(() => service.verify(firstToken, user.email)).toThrow(
        "This sign-in link has already been used.",
      );
      expect(service.verify(secondToken, user.email).id).toBe(user.id);
    } finally {
      database.close();
    }
  });

  it("removes the stored link if delivery fails", async () => {
    const { database, repository } = createTestRepository();
    const mailer = new CapturingMailer(new Error("Mailer unavailable."));
    const service = new MagicLinkService(repository, mailer, 30);
    const user = createUser("user_magic_link_failure", "pat.person@example.com");

    repository.saveUser(user);

    try {
      await expect(service.sendInvite(user, "http://localhost:3000")).rejects.toThrow(
        "Mailer unavailable.",
      );
      expect(countMagicLinks(database)).toBe(0);
    } finally {
      database.close();
    }
  });

  it("rejects expired links during verification", () => {
    const { database, repository } = createTestRepository();
    const mailer = new CapturingMailer();
    const service = new MagicLinkService(repository, mailer, 30);
    const user = createUser("user_magic_link_expired", "jules.person@example.com");

    repository.saveUser(user);
    repository.saveMagicLink({
      createdAt: "2024-01-01T00:00:00.000Z",
      email: user.email,
      expiresAt: "2024-01-01T00:10:00.000Z",
      id: "magic_link_expired_1",
      purpose: "signin",
      tokenHash: hashMagicLinkToken("expired-token"),
      usedAt: null,
      userId: user.id,
    });

    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:10:01.000Z"));

      expect(() => service.verify("expired-token", user.email)).toThrow(
        "This sign-in link has expired.",
      );
    } finally {
      database.close();
      vi.useRealTimers();
    }
  });
});

class CapturingMailer {
  readonly messages: MikroLensMailerMessage[] = [];
  readonly #error: Error | null;

  constructor(error: Error | null = null) {
    this.#error = error;
  }

  async send(message: MikroLensMailerMessage): Promise<void> {
    if (this.#error) {
      throw this.#error;
    }

    this.messages.push(message);
  }
}

function createUser(id: string, email: string) {
  return User.invite({
    email,
    id,
    now: "2024-01-01T00:00:00.000Z",
  }).toDTO();
}

function countMagicLinks(database: { get<T>(sql: string, ...parameters: unknown[]): T | null }) {
  return database.get<{ count: number }>("SELECT COUNT(*) as count FROM magic_links")?.count ?? 0;
}

function extractMagicLinkToken(message: MikroLensMailerMessage | undefined): string {
  const link = message?.text.match(/https?:\/\/\S+/)?.[0];

  if (!link) {
    throw new Error("Expected a magic link in the delivered email.");
  }

  const token = new URL(link).searchParams.get("token");

  if (!token) {
    throw new Error("Expected the delivered magic link to include a token.");
  }

  return token;
}
