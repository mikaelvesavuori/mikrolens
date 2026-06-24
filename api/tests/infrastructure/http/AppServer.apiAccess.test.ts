import { User } from "../../../src/domain/User.ts";
import { createTestServer } from "../../support/testUtils.ts";

function createAdminSession(server: Awaited<ReturnType<typeof createTestServer>>, id: string) {
  const now = new Date().toISOString();
  const adminUser = User.invite({
    email: `${id}@example.com`,
    id,
    now,
    role: "Admin",
  })
    .recordSignIn(now)
    .toDTO();

  server.repository.saveUser(adminUser);

  return {
    adminCookie: server.sessionSecurity.createSessionCookie(adminUser),
    adminUser,
  };
}

describe("AppServer API access", () => {
  it("documents session and bearer auth plus richer work-item filters in OpenAPI", async () => {
    const server = await createTestServer();

    try {
      const response = await fetch(`${server.baseUrl}/openapi.json`);

      expect(response.status).toBe(200);

      const schema = await response.json();
      const workItemParameters =
        schema?.paths?.["/api/work-items"]?.get?.parameters?.map(
          (parameter: { name?: string }) => parameter.name,
        ) ?? [];

      expect(schema?.components?.securitySchemes?.sessionCookie).toBeTruthy();
      expect(schema?.components?.securitySchemes?.bearerAuth).toBeTruthy();
      expect(schema?.paths?.["/auth/metadata"]?.get).toBeTruthy();
      expect(workItemParameters).toContain("ownerUserId");
      expect(workItemParameters).toContain("sortBy");
      expect(
        schema?.paths?.["/api/work-items"]?.get?.responses?.["200"]?.headers?.["X-Total-Count"],
      ).toBeTruthy();
      expect(
        schema?.paths?.["/api/api-identities"]?.post?.requestBody?.content?.["application/json"]
          ?.examples?.deliveryBot,
      ).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it("publishes auth metadata and requires sign-in for bootstrap data", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "bootstrap_admin");

    try {
      const metadataResponse = await fetch(`${server.baseUrl}/auth/metadata`);
      const unauthenticatedBootstrap = await fetch(`${server.baseUrl}/api/bootstrap`);
      const authenticatedBootstrap = await fetch(`${server.baseUrl}/api/bootstrap`, {
        headers: {
          Cookie: adminCookie,
        },
      });

      expect(metadataResponse.status).toBe(200);
      await expect(metadataResponse.json()).resolves.toMatchObject({
        authenticationRequired: true,
        demoLoginEnabled: true,
        hasUsers: true,
      });

      expect(unauthenticatedBootstrap.status).toBe(401);
      await expect(unauthenticatedBootstrap.json()).resolves.toEqual({
        error: "Sign in is required.",
      });

      expect(authenticatedBootstrap.status).toBe(200);
      await expect(authenticatedBootstrap.json()).resolves.toMatchObject({
        meta: {
          productName: "MikroLens",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("accepts MikroAuth bearer tokens for signed-in users", async () => {
    const server = await createTestServer();
    const { adminUser } = createAdminSession(server, "bearer_admin");

    try {
      const tokens = await server.auth.createToken({
        email: adminUser.email,
        role: adminUser.role,
        username: adminUser.name ?? adminUser.email,
      });
      const response = await fetch(`${server.baseUrl}/api/bootstrap`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        meta: {
          productName: "MikroLens",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("lets signed-in users fetch only the spaces and work they can access", async () => {
    const server = await createTestServer();
    const now = new Date().toISOString();
    const jonas = server.repository.getUserByEmail("jonas@example.com");

    if (!jonas) {
      throw new Error("Expected Jonas seed user to exist.");
    }

    const limitedUser = User.invite({
      email: "limited.user@example.com",
      id: "user_limited_api_access",
      now,
      permissions: {
        boards: {
          grants: [
            {
              boardId: "space_iam",
              level: "viewer",
            },
          ],
          scope: "boards",
        },
        documents: "viewer",
        signals: "viewer",
      },
      role: "User",
    })
      .recordSignIn(now)
      .toDTO();

    server.repository.saveUser(limitedUser);
    const limitedUserCookie = server.sessionSecurity.createSessionCookie(limitedUser);

    try {
      const spacesResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        headers: {
          Cookie: limitedUserCookie,
        },
      });
      const workItemsResponse = await fetch(
        `${server.baseUrl}/api/work-items?spaceId=space_iam&state=Active&ownerUserId=${encodeURIComponent(jonas.id)}&source=unplanned&limit=1&offset=0&sortBy=updatedAt&sortDirection=desc`,
        {
          headers: {
            Cookie: limitedUserCookie,
          },
        },
      );
      const outOfScopeResponse = await fetch(
        `${server.baseUrl}/api/work-items?spaceId=space_platform`,
        {
          headers: {
            Cookie: limitedUserCookie,
          },
        },
      );

      expect(spacesResponse.status).toBe(200);
      await expect(spacesResponse.json()).resolves.toEqual([
        expect.objectContaining({
          id: "space_iam",
          name: "IAM",
        }),
      ]);

      expect(workItemsResponse.status).toBe(200);
      expect(workItemsResponse.headers.get("x-total-count")).toBe("1");
      await expect(workItemsResponse.json()).resolves.toEqual([
        expect.objectContaining({
          ownerUserIds: [jonas.id],
          ref: "ML-43",
          spaceId: "space_iam",
          state: "Active",
          title: "Service token rotation emails missing space context",
        }),
      ]);

      expect(outOfScopeResponse.status).toBe(200);
      await expect(outOfScopeResponse.json()).resolves.toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("lets scoped API identities query accessible work while denying document access they do not have", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "api_identity_admin");
    const jonas = server.repository.getUserByEmail("jonas@example.com");

    if (!jonas) {
      throw new Error("Expected Jonas seed user to exist.");
    }

    try {
      const createIdentityResponse = await fetch(`${server.baseUrl}/api/api-identities`, {
        body: JSON.stringify({
          description: "Reads IAM delivery work only.",
          name: "IAM Reader",
          permissions: {
            boards: {
              grants: [
                {
                  boardId: "space_iam",
                  level: "viewer",
                },
              ],
              scope: "boards",
            },
            documents: null,
            signals: "viewer",
          },
          status: "Active",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(createIdentityResponse.status).toBe(201);
      const created = await createIdentityResponse.json();

      const spacesResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        headers: {
          Authorization: `Bearer ${created.token}`,
        },
      });
      const workItemsResponse = await fetch(
        `${server.baseUrl}/api/work-items?spaceId=space_iam&state=Active&ownerUserId=${encodeURIComponent(jonas.id)}&source=unplanned&limit=1&offset=0&sortBy=updatedAt&sortDirection=desc`,
        {
          headers: {
            Authorization: `Bearer ${created.token}`,
          },
        },
      );
      const documentsResponse = await fetch(`${server.baseUrl}/api/documents`, {
        headers: {
          Authorization: `Bearer ${created.token}`,
        },
      });

      expect(spacesResponse.status).toBe(200);
      await expect(spacesResponse.json()).resolves.toEqual([
        expect.objectContaining({
          id: "space_iam",
        }),
      ]);

      expect(workItemsResponse.status).toBe(200);
      expect(workItemsResponse.headers.get("x-total-count")).toBe("1");
      await expect(workItemsResponse.json()).resolves.toEqual([
        expect.objectContaining({
          ownerUserIds: [jonas.id],
          ref: "ML-43",
          spaceId: "space_iam",
        }),
      ]);

      expect(documentsResponse.status).toBe(403);
      await expect(documentsResponse.json()).resolves.toEqual({
        error: "Document access is required.",
      });
    } finally {
      await server.close();
    }
  });
});
