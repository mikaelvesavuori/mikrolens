import { completeOAuthSignIn } from "../../../src/application/usecases/auth/completeOAuthSignIn.ts";
import { listOAuthProviders } from "../../../src/application/usecases/auth/listOAuthProviders.ts";
import { signInUserFromOAuth } from "../../../src/application/usecases/auth/signInUserFromOAuth.ts";
import { startOAuthSignIn } from "../../../src/application/usecases/auth/startOAuthSignIn.ts";
import { createUser } from "../../../src/application/usecases/users/createUser.ts";
import { inviteUser } from "../../../src/application/usecases/users/inviteUser.ts";
import { createWebhookEndpoint } from "../../../src/application/usecases/webhooks/createWebhookEndpoint.ts";
import { deleteWebhookEndpoint } from "../../../src/application/usecases/webhooks/deleteWebhookEndpoint.ts";
import { getWebhookDeliveries } from "../../../src/application/usecases/webhooks/getWebhookDeliveries.ts";
import { updateWebhookEndpoint } from "../../../src/application/usecases/webhooks/updateWebhookEndpoint.ts";
import { createApiIdentityFromInput } from "../../../src/infrastructure/http/inputs/createApiIdentityFromInput.ts";
import { createDocumentFromInput } from "../../../src/infrastructure/http/inputs/createDocumentFromInput.ts";
import { createHorizonFromInput } from "../../../src/infrastructure/http/inputs/createHorizonFromInput.ts";
import { createSignalFromInput } from "../../../src/infrastructure/http/inputs/createSignalFromInput.ts";
import { createSpaceFromInput } from "../../../src/infrastructure/http/inputs/createSpaceFromInput.ts";
import { createWorkItemFromInput } from "../../../src/infrastructure/http/inputs/createWorkItemFromInput.ts";
import { inviteUserFromInput } from "../../../src/infrastructure/http/inputs/inviteUserFromInput.ts";
import { linkDocumentToWorkItemFromInput } from "../../../src/infrastructure/http/inputs/linkDocumentToWorkItemFromInput.ts";
import { pullSignalToSpaceFromInput } from "../../../src/infrastructure/http/inputs/pullSignalToSpaceFromInput.ts";
import { requestMagicLinkSignInFromInput } from "../../../src/infrastructure/http/inputs/requestMagicLinkSignInFromInput.ts";
import { unlinkDocumentFromWorkItemFromInput } from "../../../src/infrastructure/http/inputs/unlinkDocumentFromWorkItemFromInput.ts";
import { updateApiIdentityFromInput } from "../../../src/infrastructure/http/inputs/updateApiIdentityFromInput.ts";
import { updateDocumentFromInput } from "../../../src/infrastructure/http/inputs/updateDocumentFromInput.ts";
import { updateHorizonFromInput } from "../../../src/infrastructure/http/inputs/updateHorizonFromInput.ts";
import { updateSignalFromInput } from "../../../src/infrastructure/http/inputs/updateSignalFromInput.ts";
import { updateSpaceFromInput } from "../../../src/infrastructure/http/inputs/updateSpaceFromInput.ts";
import { updateUserFromInput } from "../../../src/infrastructure/http/inputs/updateUserFromInput.ts";
import { updateWorkItemFromInput } from "../../../src/infrastructure/http/inputs/updateWorkItemFromInput.ts";
import { verifyMagicLinkSignInFromInput } from "../../../src/infrastructure/http/inputs/verifyMagicLinkSignInFromInput.ts";
import { createTestRepository } from "../../support/testUtils.ts";

describe("application orchestration", () => {
  it("manages webhook endpoints through application use cases", () => {
    const { database, repository } = createTestRepository();

    try {
      const created = createWebhookEndpoint(repository, {
        name: "Platform feed",
        secret: "super-secret",
        spaceId: "space_platform",
        status: "Active",
        subscribedEvents: ["work-item.created", "state.changed"],
        url: "https://example.com/webhooks/platform",
      });
      const deliveries = getWebhookDeliveries(repository, {
        endpointId: created.id,
        limit: 50,
      });
      const updated = updateWebhookEndpoint(repository, {
        id: created.id,
        status: "Paused",
        subscribedEvents: ["work-item.*"],
      });

      deleteWebhookEndpoint(repository, created.id);

      expect(created.status).toBe("Active");
      expect(deliveries).toEqual([]);
      expect(updated.status).toBe("Paused");
      expect(updated.subscribedEvents).toEqual(["work-item.*"]);
      expect(repository.getWebhookEndpoint(created.id)).toBeNull();
    } finally {
      database.close();
    }
  });

  it("invites users through an application use case and rolls back on delivery failure", async () => {
    const { database, repository } = createTestRepository();
    const sentInvites: string[] = [];

    try {
      const created = await inviteUser(
        repository,
        {
          sendInvite: async (user) => {
            sentInvites.push(user.email);
          },
        },
        "http://localhost:3000",
        {
          email: "sam.person@example.com",
          name: "Sam Person",
          role: "Admin",
        },
      );

      expect(created.status).toBe("Invited");
      expect(sentInvites).toEqual(["sam.person@example.com"]);

      await expect(
        inviteUser(
          repository,
          {
            sendInvite: async () => {
              throw new Error("Mailer unavailable.");
            },
          },
          "http://localhost:3000",
          {
            email: "alex.person@example.com",
            name: "Alex Person",
          },
        ),
      ).rejects.toThrow("Mailer unavailable.");

      expect(repository.getUserByEmail("alex.person@example.com")).toBeNull();
    } finally {
      database.close();
    }
  });

  it("completes OAuth sign-in through an application use case", () => {
    const { database, repository } = createTestRepository();

    try {
      createUser(repository, {
        email: "sam.person@example.com",
        name: "Sam Person",
      });

      const signedIn = signInUserFromOAuth(repository, "sam.person@example.com");

      expect(signedIn.status).toBe("Active");
      expect(signedIn.activatedAt).toEqual(expect.any(String));
      expect(signedIn.lastSignedInAt).toEqual(expect.any(String));
      expect(() => signInUserFromOAuth(repository, "missing@example.com")).toThrow(
        "User not found. You must be invited before signing in with SSO.",
      );
    } finally {
      database.close();
    }
  });

  it("orchestrates OAuth provider listing and authorization start through application use cases", () => {
    const providers = new Map([
      [
        "acme",
        {
          getAuthorizationUrl: (state: string) =>
            `https://id.acme.test/authorize?state=${encodeURIComponent(state)}`,
          getPublicInfo: () => ({
            id: "acme",
            loginUrl: "/auth/oauth/acme",
            name: "Acme SSO",
          }),
          handleCallback: async () => ({
            email: "sam.person@example.com",
            id: "oauth-user-1",
          }),
        },
      ],
    ]);
    const security = {
      checkRateLimit: () => true,
      generateState: () => "oauth-state",
      getRateLimitInfo: () => ({
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
      }),
      validateCallback: () => ({
        code: "oauth-code",
        valid: true,
      }),
    };

    expect(listOAuthProviders(providers.values())).toEqual({
      count: 1,
      providers: [
        {
          id: "acme",
          loginUrl: "/auth/oauth/acme",
          name: "Acme SSO",
        },
      ],
    });
    expect(
      startOAuthSignIn(providers, security, "acme", {
        ip: "203.0.113.10",
        userAgent: "vitest",
      }),
    ).toEqual({
      kind: "authorization-redirect",
      location: "https://id.acme.test/authorize?state=oauth-state",
    });
    expect(
      startOAuthSignIn(
        providers,
        {
          ...security,
          checkRateLimit: () => false,
          getRateLimitInfo: () => ({
            limit: 10,
            remaining: 0,
            reset: 8_000,
          }),
        },
        "acme",
        {
          ip: "203.0.113.10",
          userAgent: "vitest",
        },
        5_000,
      ),
    ).toEqual({
      kind: "rate-limited",
      retryAfter: 3,
    });
  });

  it("orchestrates OAuth callback completion through an application use case", async () => {
    const { database, repository } = createTestRepository();

    try {
      createUser(repository, {
        email: "sam.person@example.com",
        name: "Sam Person",
      });

      const providers = new Map([
        [
          "acme",
          {
            getAuthorizationUrl: () => "https://id.acme.test/authorize",
            getPublicInfo: () => ({
              id: "acme",
              loginUrl: "/auth/oauth/acme",
              name: "Acme SSO",
            }),
            handleCallback: async () => ({
              email: "sam.person@example.com",
              id: "oauth-user-1",
            }),
          },
        ],
      ]);
      const security = {
        checkRateLimit: () => true,
        generateState: () => "oauth-state",
        getRateLimitInfo: () => ({
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60_000,
        }),
        validateCallback: () => ({
          code: "oauth-code",
          valid: true,
        }),
      };

      await expect(
        completeOAuthSignIn(
          repository,
          providers,
          security,
          "acme",
          {
            ip: "203.0.113.10",
            userAgent: "vitest",
          },
          {
            code: "oauth-code",
            state: "oauth-state",
          },
        ),
      ).resolves.toEqual({
        authStatus: "success",
        email: "sam.person@example.com",
        kind: "app-redirect",
        message: "",
      });
      await expect(
        completeOAuthSignIn(
          repository,
          providers,
          {
            ...security,
            validateCallback: () => ({
              error: "OAuth sign-in expired. Please try again.",
              valid: false,
            }),
          },
          "acme",
          {
            ip: "203.0.113.10",
            userAgent: "vitest",
          },
          {
            state: "oauth-state",
          },
        ),
      ).resolves.toEqual({
        authStatus: "error",
        kind: "app-redirect",
        message: "OAuth sign-in expired. Please try again.",
      });
    } finally {
      database.close();
    }
  });

  it("validates magic-link request input through an application use case", async () => {
    const requests: Array<{ baseUrl: string; email: string }> = [];
    const service = {
      sendSignInLink: async (email: string, baseUrl: string) => {
        requests.push({ baseUrl, email });
        return {
          message: "If this email can sign in, you will receive a sign-in link shortly.",
        };
      },
    };

    const response = await requestMagicLinkSignInFromInput(service, "http://localhost:3000", {
      email: " sam.person@example.com ",
    });

    expect(response.message).toBe(
      "If this email can sign in, you will receive a sign-in link shortly.",
    );
    expect(requests).toEqual([
      {
        baseUrl: "http://localhost:3000",
        email: "sam.person@example.com",
      },
    ]);
    await expect(
      requestMagicLinkSignInFromInput(service, "http://localhost:3000", {
        email: "   ",
      }),
    ).rejects.toThrow("Email is required.");
    await expect(
      requestMagicLinkSignInFromInput(service, "http://localhost:3000", {
        email: "not-an-email",
      }),
    ).rejects.toThrow("Email must be valid.");
  });

  it("validates magic-link verification input through an application use case", () => {
    const { database, repository } = createTestRepository();

    try {
      const user = createUser(repository, {
        email: "sam.person@example.com",
        name: "Sam Person",
      });
      const verifications: Array<{ email: string; token: string }> = [];
      const service = {
        verify: (token: string, email: string) => {
          verifications.push({ email, token });
          return user;
        },
      };

      const verified = verifyMagicLinkSignInFromInput(service, {
        email: " sam.person@example.com ",
        token: " sign-in-token ",
      });

      expect(verified.email).toBe("sam.person@example.com");
      expect(verifications).toEqual([
        {
          email: "sam.person@example.com",
          token: "sign-in-token",
        },
      ]);
      expect(() => verifyMagicLinkSignInFromInput(service, {})).toThrow(
        "Both token and email are required.",
      );
    } finally {
      database.close();
    }
  });

  it("resolves API identity policy input through application use cases", () => {
    const { database, repository } = createTestRepository();

    try {
      const defaulted = createApiIdentityFromInput(repository, {
        name: "Read Only Bot",
      });
      const created = createApiIdentityFromInput(repository, {
        name: "Release Bot",
        permissions: {
          boards: {
            grants: [{ boardId: "space_platform", level: "editor" }],
            scope: "boards",
          },
          documents: "viewer",
          signals: "viewer",
        },
      });
      const updated = updateApiIdentityFromInput(repository, {
        id: created.apiIdentity.id,
        permissions: {
          boards: {
            level: "admin",
            scope: "all",
          },
          documents: "editor",
          signals: null,
        },
        status: "Paused",
      });

      expect(defaulted.apiIdentity.permissions).toEqual({
        boards: {
          level: "viewer",
          scope: "all",
        },
        documents: "viewer",
        signals: "viewer",
      });
      expect(created.apiIdentity.permissions.boards.scope).toBe("boards");
      expect(updated.permissions.boards.scope).toBe("all");
      expect(updated.permissions.documents).toBe("editor");
      expect(updated.status).toBe("Paused");
    } finally {
      database.close();
    }
  });

  it("resolves user policy input through application use cases", async () => {
    const { database, repository } = createTestRepository();

    try {
      const created = await inviteUserFromInput(
        repository,
        {
          sendInvite: async () => undefined,
        },
        "http://localhost:3000",
        {
          email: "sam.person@example.com",
          permissions: {
            boards: {
              grants: [{ boardId: "space_product", level: "editor" }],
              scope: "boards",
            },
            documents: "viewer",
            signals: "editor",
          },
          role: "Admin",
        },
      );
      const updated = updateUserFromInput(repository, {
        id: created.id,
        permissions: {
          boards: {
            level: null,
            scope: "all",
          },
          documents: "editor",
          signals: null,
        },
        role: "User",
      });

      expect(created.permissions.boards.scope).toBe("boards");
      expect(created.role).toBe("Admin");
      expect(updated.permissions.boards.scope).toBe("all");
      expect(updated.permissions.signals).toBeNull();
      expect(updated.role).toBe("User");
    } finally {
      database.close();
    }
  });

  it("resolves space and horizon input through application use cases", () => {
    const { database, repository } = createTestRepository();

    try {
      const createdSpace = createSpaceFromInput(repository, {
        name: "Operations",
      });
      const updatedSpace = updateSpaceFromInput(repository, {
        description: "Operational delivery and support.",
        id: createdSpace.id,
        name: "Ops",
      });
      const seededHorizon = repository
        .listHorizons()
        .find((horizon) => horizon.spaceId === createdSpace.id && horizon.key === "horizon_3");
      const duplicateCreate = () =>
        createHorizonFromInput(repository, {
          key: "horizon_3",
          spaceId: createdSpace.id,
        });

      expect(seededHorizon).toBeTruthy();
      expect(duplicateCreate).toThrow("That horizon already exists for the space.");

      if (!seededHorizon) {
        throw new Error("Expected seeded Later horizon.");
      }

      const updatedHorizon = updateHorizonFromInput(repository, {
        id: seededHorizon.id,
        label: "Someday later",
        timeframeText: "Longer-range work that stays visible but not yet scheduled.",
      });

      expect(createdSpace.name).toBe("Operations");
      expect(updatedSpace.name).toBe("Ops");
      expect(updatedHorizon.label).toBe("Someday later");
    } finally {
      database.close();
    }
  });

  it("resolves work, signal, and document input through application use cases", () => {
    const { database, repository } = createTestRepository();

    try {
      const createdWorkItem = createWorkItemFromInput(repository, {
        spaceId: "space_platform",
        state: "Ready",
        title: "Refine API orchestration",
        type: "Task",
      });
      const updatedWorkItem = updateWorkItemFromInput(repository, {
        id: createdWorkItem.id,
        state: "Active",
      });
      const createdDocument = createDocumentFromInput(repository, {
        spaceId: null,
        type: "Note",
      });
      const linkedWorkItem = linkDocumentToWorkItemFromInput(repository, {
        documentId: createdDocument.id,
        workItemId: createdWorkItem.id,
      });
      const unlinkedWorkItem = unlinkDocumentFromWorkItemFromInput(repository, {
        documentId: createdDocument.id,
        workItemId: createdWorkItem.id,
      });
      const updatedDocument = updateDocumentFromInput(repository, {
        id: createdDocument.id,
        title: "Refined API orchestration notes",
        type: "Strategy",
      });
      const createdSignal = createSignalFromInput(repository, {
        source: "Mikael",
        title: "Capture API cleanup ideas",
        urgency: "High",
      });
      const updatedSignal = updateSignalFromInput(repository, {
        id: createdSignal.id,
        urgency: "Low",
      });
      const pulledSignal = pullSignalToSpaceFromInput(repository, {
        signalId: createdSignal.id,
        targetSpaceId: "space_product",
      });

      expect(createdWorkItem.state).toBe("Ready");
      expect(updatedWorkItem.state).toBe("Active");
      expect(createdDocument.type).toBe("Note");
      expect(linkedWorkItem?.linkedDocuments.map((document) => document.id)).toContain(
        createdDocument.id,
      );
      expect(unlinkedWorkItem?.linkedDocuments.map((document) => document.id)).not.toContain(
        createdDocument.id,
      );
      expect(updatedDocument.type).toBe("Strategy");
      expect(createdSignal.urgency).toBe("High");
      expect(updatedSignal.urgency).toBe("Low");
      expect(pulledSignal.spaceId).toBe("space_product");
    } finally {
      database.close();
    }
  });
});
