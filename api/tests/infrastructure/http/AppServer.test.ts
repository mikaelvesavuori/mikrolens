import {
  createServer,
  type RequestOptions as HttpRequestOptions,
  request as sendHttpRequest,
} from "node:http";
import type { AddressInfo } from "node:net";
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

describe("AppServer", () => {
  it("serves the bootstrap payload and static app shell", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "bootstrap_shell_admin");

    try {
      const bootstrapResponse = await fetch(`${server.baseUrl}/api/bootstrap`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const openApiResponse = await fetch(`${server.baseUrl}/openapi.json`);
      const pageResponse = await fetch(`${server.baseUrl}/`);

      expect(bootstrapResponse.status).toBe(200);
      expect(openApiResponse.status).toBe(200);
      expect(pageResponse.status).toBe(200);

      const bootstrap = await bootstrapResponse.json();
      const openApi = await openApiResponse.json();
      const html = await pageResponse.text();

      expect(bootstrap.meta.productName).toBe("MikroLens");
      expect(bootstrap.meta.accessLevels).toContain("editor");
      expect(bootstrap.meta.apiIdentityStatuses).toContain("Active");
      expect(bootstrap.meta.userRoles).toContain("Admin");
      expect(Array.isArray(bootstrap.apiIdentities)).toBe(true);
      expect(Array.isArray(bootstrap.users)).toBe(true);
      expect(openApi.paths["/api/documents/{id}"]).toBeTruthy();
      expect(openApi.servers).toEqual([{ url: server.baseUrl }]);
      expect(html).toContain("<title>MikroLens</title>");
    } finally {
      await server.close();
    }
  });

  it("exposes health endpoints with deployment checks", async () => {
    const server = await createTestServer();

    try {
      const [healthResponse, apiHealthResponse] = await Promise.all([
        fetch(`${server.baseUrl}/health`),
        fetch(`${server.baseUrl}/api/health`),
      ]);

      expect(healthResponse.status).toBe(200);
      expect(apiHealthResponse.status).toBe(200);

      const health = await healthResponse.json();
      const apiHealth = await apiHealthResponse.json();

      expect(health.service).toBe("mikrolens-api");
      expect(health.status).toBe("healthy");
      expect(health.checks).toEqual({
        database: "up",
        staticFiles: "up",
      });
      expect(health.details).toBeUndefined();
      expect(apiHealth.checks.database).toBe("up");
    } finally {
      await server.close();
    }
  });

  it("serves the app shell for deep links", async () => {
    const server = await createTestServer();

    try {
      const [settingsResponse, workItemResponse] = await Promise.all([
        fetch(`${server.baseUrl}/settings`),
        fetch(`${server.baseUrl}/work-items/work_item_missing`),
      ]);

      expect(settingsResponse.status).toBe(200);
      expect(workItemResponse.status).toBe(200);
      expect(await settingsResponse.text()).toContain("<title>MikroLens</title>");
      expect(await workItemResponse.text()).toContain("<title>MikroLens</title>");
    } finally {
      await server.close();
    }
  });

  it("returns credentialed CORS headers for the configured frontend origin", async () => {
    const server = await createTestServer({
      appUrl: "https://app.example.com",
    });
    const serverUrl = new URL(server.baseUrl);

    try {
      const response = await sendRawHttpRequest({
        headers: {
          "access-control-request-method": "POST",
          host: `localhost:${serverUrl.port}`,
          origin: "https://app.example.com",
        },
        hostname: serverUrl.hostname,
        method: "OPTIONS",
        path: "/auth/login",
        port: Number(serverUrl.port),
      });

      expect(response.statusCode).toBe(204);
      expect(readHeader(response.headers, "access-control-allow-origin")).toBe(
        "https://app.example.com",
      );
      expect(readHeader(response.headers, "access-control-allow-credentials")).toBe("true");
      expect(readHeader(response.headers, "vary")).toContain("Origin");
    } finally {
      await server.close();
    }
  });

  it("starts with a clean workspace and no demo login unless demo mode is enabled", async () => {
    const server = await createTestServer({
      demoLoginEnabled: false,
      seedDemoData: false,
    });

    try {
      const metadataResponse = await fetch(`${server.baseUrl}/auth/metadata`);
      const usersResponse = await fetch(`${server.baseUrl}/auth/demo-users`);
      const demoLoginResponse = await fetch(`${server.baseUrl}/auth/demo-login`, {
        body: JSON.stringify({
          userId: "user_mikael",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const spacesResponse = await fetch(`${server.baseUrl}/api/spaces`);

      expect(server.repository.listHorizonDefaults()).toHaveLength(3);
      expect(server.repository.listUsers()).toHaveLength(0);
      expect(server.repository.listSpaces()).toHaveLength(0);

      expect(metadataResponse.status).toBe(200);
      await expect(metadataResponse.json()).resolves.toEqual({
        authenticationRequired: true,
        demoLoginEnabled: false,
        hasUsers: false,
      });

      expect(usersResponse.status).toBe(200);
      await expect(usersResponse.json()).resolves.toEqual({
        count: 0,
        users: [],
      });

      expect(demoLoginResponse.status).toBe(404);
      await expect(demoLoginResponse.json()).resolves.toEqual({
        error: "Demo sign-in is not enabled.",
      });

      expect(spacesResponse.status).toBe(401);
      await expect(spacesResponse.json()).resolves.toEqual({
        error: "Sign in is required.",
      });
    } finally {
      await server.close();
    }
  });

  it("lists demo users and can sign in directly as one of them", async () => {
    const server = await createTestServer();

    try {
      const usersResponse = await fetch(`${server.baseUrl}/auth/demo-users`);

      expect(usersResponse.status).toBe(200);

      const usersPayload = await usersResponse.json();
      const demoUser = usersPayload.users.find(
        (user: { email: string; id: string }) => user.email === "mikael@example.com",
      );

      expect(usersPayload.count).toBeGreaterThan(0);
      expect(demoUser).toBeTruthy();

      const signInResponse = await fetch(`${server.baseUrl}/auth/demo-login`, {
        body: JSON.stringify({
          userId: demoUser.id,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(signInResponse.status).toBe(200);

      const sessionCookie = signInResponse.headers.get("set-cookie");
      const signInPayload = await signInResponse.json();

      expect(sessionCookie).toContain("mikrolens_session=");
      expect(signInPayload.user.email).toBe("mikael@example.com");

      const sessionResponse = await fetch(`${server.baseUrl}/auth/session`, {
        headers: {
          Cookie: sessionCookie ?? "",
        },
      });

      expect(sessionResponse.status).toBe(200);
      await expect(sessionResponse.json()).resolves.toMatchObject({
        user: {
          email: "mikael@example.com",
          id: demoUser.id,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns a 400 for invalid JSON bodies", async () => {
    const server = await createTestServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/work-items`, {
        body: "{",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid JSON body.",
      });
    } finally {
      await server.close();
    }
  });

  it("returns a 413 for oversized JSON bodies", async () => {
    const server = await createTestServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/work-items`, {
        body: JSON.stringify({
          summary: "x".repeat(1024 * 1024),
          title: "Oversized item",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: "JSON body is too large.",
      });
    } finally {
      await server.close();
    }
  });

  it("rate limits passwordless sign-in requests", async () => {
    const server = await createTestServer();

    try {
      let response: Response | undefined;

      for (let index = 0; index < 6; index += 1) {
        response = await fetch(`${server.baseUrl}/auth/login`, {
          body: JSON.stringify({
            email: "rate-limited@example.com",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      }

      if (!response) {
        throw new Error("Expected a rate-limited response.");
      }

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toEqual(expect.any(String));
      await expect(response.json()).resolves.toEqual({
        error: "Too many sign-in attempts. Please try again later.",
      });
    } finally {
      await server.close();
    }
  });

  it("returns a 404 for missing records on delete routes", async () => {
    const server = await createTestServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/work-items/work_item_missing`, {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: "Work item not found.",
      });
    } finally {
      await server.close();
    }
  });

  it("supports creating documents through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_document_create_admin");

    try {
      const response = await fetch(`${server.baseUrl}/api/documents`, {
        body: JSON.stringify({
          spaceId: "space_platform",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await response.json();
      const detailResponse = await fetch(`${server.baseUrl}/api/documents/${created.id}`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const detail = await detailResponse.json();

      expect(response.status).toBe(201);
      expect(detailResponse.status).toBe(200);
      expect(created.type).toBe("Note");
      expect(created.spaceId).toBe("space_platform");
      expect(created.title).toBe("Untitled document");
      expect(detail.markdown).toContain("# Untitled document");
    } finally {
      await server.close();
    }
  });

  it("supports creating standalone documents through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_standalone_document_admin");

    try {
      const response = await fetch(`${server.baseUrl}/api/documents`, {
        body: JSON.stringify({}),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await response.json();
      const detailResponse = await fetch(`${server.baseUrl}/api/documents/${created.id}`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const detail = await detailResponse.json();

      expect(response.status).toBe(201);
      expect(detailResponse.status).toBe(200);
      expect(created.spaceId).toBeNull();
      expect(created.spaceName).toBeNull();
      expect(detail.spaceId).toBeNull();
      expect(detail.spaceName).toBeNull();
      expect(detail.markdown).toContain("# Untitled document");
    } finally {
      await server.close();
    }
  });

  it("blocks changing your own role or permissions through the user API", async () => {
    const server = await createTestServer();
    const now = new Date().toISOString();
    const adminUser = User.invite({
      email: "admin@example.com",
      id: "user_self_admin_guard",
      now,
      role: "Admin",
    })
      .recordSignIn(now)
      .toDTO();

    server.repository.saveUser(adminUser);

    try {
      const response = await fetch(`${server.baseUrl}/api/users/${adminUser.id}`, {
        body: JSON.stringify({
          role: "User",
        }),
        headers: {
          "Content-Type": "application/json",
          Cookie: server.sessionSecurity.createSessionCookie(adminUser),
        },
        method: "PATCH",
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "You cannot change your own role or permissions.",
      });
    } finally {
      await server.close();
    }
  });

  it("allows updating your own name without admin role changes", async () => {
    const server = await createTestServer();
    const now = new Date().toISOString();
    const currentUser = User.invite({
      email: "self-update@example.com",
      id: "user_self_name_update",
      name: "Mikael",
      now,
      role: "User",
    })
      .recordSignIn(now)
      .toDTO();

    server.repository.saveUser(currentUser);

    try {
      const response = await fetch(`${server.baseUrl}/api/users/${currentUser.id}`, {
        body: JSON.stringify({
          name: "Mikael Vesavuori",
        }),
        headers: {
          "Content-Type": "application/json",
          Cookie: server.sessionSecurity.createSessionCookie(currentUser),
        },
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        email: "self-update@example.com",
        name: "Mikael Vesavuori",
        role: "User",
      });
      expect(server.repository.getUser(currentUser.id)?.name).toBe("Mikael Vesavuori");
    } finally {
      await server.close();
    }
  });

  it("requires document access before a user can link a standalone document to work in a space", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_document_link_admin");
    const now = new Date().toISOString();
    const limitedUser = User.invite({
      email: "space-editor@example.com",
      id: "user_space_editor_only",
      now,
      permissions: {
        boards: {
          grants: [
            {
              boardId: "space_platform",
              level: "editor",
            },
          ],
          scope: "boards",
        },
        documents: null,
        signals: "viewer",
      },
      role: "User",
    })
      .recordSignIn(now)
      .toDTO();
    const documentAwareUser = User.invite({
      email: "document-aware@example.com",
      id: "user_document_aware",
      now,
      permissions: {
        boards: {
          grants: [
            {
              boardId: "space_platform",
              level: "editor",
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
    server.repository.saveUser(documentAwareUser);

    try {
      const workItemResponse = await fetch(`${server.baseUrl}/api/work-items`, {
        body: JSON.stringify({
          spaceId: "space_platform",
          title: "Link a standalone evolution",
          type: "Task",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const workItem = await workItemResponse.json();
      const documentResponse = await fetch(`${server.baseUrl}/api/documents`, {
        body: JSON.stringify({
          title: "Standalone evolution",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const document = await documentResponse.json();
      const blockedLinkResponse = await fetch(
        `${server.baseUrl}/api/work-items/${workItem.id}/document-links`,
        {
          body: JSON.stringify({
            documentId: document.id,
          }),
          headers: {
            Cookie: server.sessionSecurity.createSessionCookie(limitedUser),
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const allowedLinkResponse = await fetch(
        `${server.baseUrl}/api/work-items/${workItem.id}/document-links`,
        {
          body: JSON.stringify({
            documentId: document.id,
          }),
          headers: {
            Cookie: server.sessionSecurity.createSessionCookie(documentAwareUser),
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      expect(workItemResponse.status).toBe(201);
      expect(documentResponse.status).toBe(201);
      expect(blockedLinkResponse.status).toBe(403);
      await expect(blockedLinkResponse.json()).resolves.toEqual({
        error: "Document access is required.",
      });
      expect(allowedLinkResponse.status).toBe(201);
      await expect(allowedLinkResponse.json()).resolves.toMatchObject({
        id: workItem.id,
      });
    } finally {
      await server.close();
    }
  });

  it("uses the incoming request origin for passwordless links and auth redirects", async () => {
    const server = await createTestServer();
    const serverUrl = new URL(server.baseUrl);
    const now = new Date().toISOString();
    const loginEmail = "magic-link-local@example.com";

    server.repository.saveUser(
      User.invite({
        email: loginEmail,
        id: "user_local_origin_test",
        now,
      }).toDTO(),
    );

    try {
      const loginResponse = await sendRawHttpRequest({
        body: JSON.stringify({
          email: loginEmail,
        }),
        headers: {
          "content-type": "application/json",
          host: `localhost:${serverUrl.port}`,
        },
        hostname: serverUrl.hostname,
        method: "POST",
        path: "/auth/login",
        port: Number(serverUrl.port),
      });

      expect(loginResponse.statusCode).toBe(200);
      expect(server.mailer.messages).toHaveLength(1);

      const text = server.mailer.messages[0]?.text ?? "";
      const magicLink = text.match(/https?:\/\/\S+/)?.[0] ?? "";

      expect(magicLink).toContain(`http://localhost:${serverUrl.port}/auth/verify`);

      const verifyUrl = new URL(magicLink);
      const verifyResponse = await sendRawHttpRequest({
        headers: {
          host: `localhost:${serverUrl.port}`,
        },
        hostname: serverUrl.hostname,
        method: "GET",
        path: `${verifyUrl.pathname}${verifyUrl.search}`,
        port: Number(serverUrl.port),
      });

      expect(verifyResponse.statusCode).toBe(302);
      expect(readHeader(verifyResponse.headers, "set-cookie")).toContain("mikrolens_session=");
      expect(verifyResponse.headers.location).toContain(
        `http://localhost:${serverUrl.port}/?auth=success`,
      );
      expect(verifyResponse.headers.location).toContain(`email=${encodeURIComponent(loginEmail)}`);
    } finally {
      await server.close();
    }
  });

  it("supports creating, updating, and linking work through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_work_link_admin");

    try {
      const createdResponse = await fetch(`${server.baseUrl}/api/work-items`, {
        body: JSON.stringify({
          spaceId: "space_platform",
          title: "Capture release note automation",
          type: "Task",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const created = await createdResponse.json();
      const updatedResponse = await fetch(`${server.baseUrl}/api/work-items/${created.id}`, {
        body: JSON.stringify({
          ownerUserIds: ["user_mikael", "user_lea"],
          state: "Done",
          targetEndDate: "2026-04-10",
          targetStartDate: "2026-04-02",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updated = await updatedResponse.json();
      const documentCreateResponse = await fetch(`${server.baseUrl}/api/documents`, {
        body: JSON.stringify({
          title: "Release note automation narrative",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const document = await documentCreateResponse.json();
      const linkResponse = await fetch(
        `${server.baseUrl}/api/work-items/${created.id}/document-links`,
        {
          body: JSON.stringify({
            documentId: document.id,
          }),
          headers: {
            Cookie: adminCookie,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const documentResponse = await fetch(`${server.baseUrl}/api/documents/${document.id}`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const detail = await documentResponse.json();

      expect(createdResponse.status).toBe(201);
      expect(updatedResponse.status).toBe(200);
      expect(documentCreateResponse.status).toBe(201);
      expect(linkResponse.status).toBe(201);
      expect(updated.state).toBe("Done");
      expect(updated.ownerName).toBe("Mikael, Lea");
      expect(updated.owners.map((owner: { id: string }) => owner.id)).toEqual([
        "user_mikael",
        "user_lea",
      ]);
      expect(updated.targetEndDate).toBe("2026-04-10");
      expect(updated.targetStartDate).toBe("2026-04-02");
      expect(detail.createdAt).toEqual(expect.any(String));
      expect(detail.updatedAt).toEqual(expect.any(String));
      expect(detail.title).toBe("Release note automation narrative");
    } finally {
      await server.close();
    }
  });

  it("supports blocked work state and clears blocker notes when unblocked through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "blocked_work_admin");

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/work-items`, {
        body: JSON.stringify({
          spaceId: "space_product",
          title: "Investigate export timeout blocker",
          type: "Problem",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();
      const blockResponse = await fetch(`${server.baseUrl}/api/work-items/${created.id}`, {
        body: JSON.stringify({
          blockedReason: "Waiting for a reproducible tenant export sample.",
          state: "Blocked",
          type: "Problem",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const blocked = await blockResponse.json();
      const unblockResponse = await fetch(`${server.baseUrl}/api/work-items/${created.id}`, {
        body: JSON.stringify({
          state: "Active",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const unblocked = await unblockResponse.json();

      expect(createResponse.status).toBe(201);
      expect(blockResponse.status).toBe(200);
      expect(unblockResponse.status).toBe(200);
      expect(blocked.state).toBe("Blocked");
      expect(blocked.type).toBe("Problem");
      expect(blocked.blockedReason).toBe("Waiting for a reproducible tenant export sample.");
      expect(unblocked.state).toBe("Active");
      expect(unblocked.blockedReason).toBe("");
    } finally {
      await server.close();
    }
  });

  it("serves the document collaboration stream and accepts live draft updates", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "document_collaboration_admin");

    try {
      const documentId = server.repository.listDocuments()[0]?.id;

      expect(documentId).toBeTruthy();

      const streamResponse = await fetch(
        `${server.baseUrl}/api/documents/${documentId}/collaboration/stream?clientId=client-alpha&name=Editor%20Alpha`,
        {
          headers: {
            Cookie: adminCookie,
          },
        },
      );

      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");

      const reader = streamResponse.body?.getReader();
      const firstChunk = reader ? await reader.read() : null;
      const firstPayload = firstChunk?.value ? new TextDecoder().decode(firstChunk.value) : "";

      expect(firstPayload).toContain("event: sync");

      const draftResponse = await fetch(
        `${server.baseUrl}/api/documents/${documentId}/collaboration/draft`,
        {
          body: JSON.stringify({
            clientId: "client-alpha",
            markdown: "# Shared draft\n\nEditing together.",
            summary: "Live collaboration summary",
            title: "Shared draft",
            type: "Note",
          }),
          headers: {
            Cookie: adminCookie,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const draft = await draftResponse.json();

      expect(draftResponse.status).toBe(202);
      expect(draft.version).toBeGreaterThan(1);

      await reader?.cancel();
    } finally {
      await server.close();
    }
  });

  it("supports managing webhook endpoints through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "webhook_management_admin");

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/webhooks`, {
        body: JSON.stringify({
          name: "Platform feed",
          secret: "super-secret",
          spaceId: "space_platform",
          subscribedEvents: ["work-item.created", "state.changed"],
          url: "https://example.com/webhooks/platform",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();
      const listResponse = await fetch(`${server.baseUrl}/api/webhooks`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const listed = await listResponse.json();
      const updateResponse = await fetch(`${server.baseUrl}/api/webhooks/${created.id}`, {
        body: JSON.stringify({
          status: "Paused",
          subscribedEvents: ["work-item.*"],
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updated = await updateResponse.json();
      const deliveriesResponse = await fetch(
        `${server.baseUrl}/api/webhooks/${created.id}/deliveries`,
        {
          headers: {
            Cookie: adminCookie,
          },
        },
      );
      const deliveries = await deliveriesResponse.json();
      const deleteResponse = await fetch(`${server.baseUrl}/api/webhooks/${created.id}`, {
        headers: {
          Cookie: adminCookie,
        },
        method: "DELETE",
      });

      expect(createResponse.status).toBe(201);
      expect(listResponse.status).toBe(200);
      expect(updateResponse.status).toBe(200);
      expect(deliveriesResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(204);
      expect(created.status).toBe("Active");
      expect(listed.some((endpoint: { id: string }) => endpoint.id === created.id)).toBe(true);
      expect(updated.status).toBe("Paused");
      expect(updated.subscribedEvents).toEqual(["work-item.*"]);
      expect(deliveries).toEqual([]);
      expect(server.repository.getWebhookEndpoint(created.id)).toBeNull();
    } finally {
      await server.close();
    }
  });

  it("enqueues webhook deliveries when work items are created and updated", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "webhook_work_items_admin");

    try {
      const endpointResponse = await fetch(`${server.baseUrl}/api/webhooks`, {
        body: JSON.stringify({
          name: "Work item feed",
          secret: "work-item-secret",
          subscribedEvents: ["work-item.created", "state.changed"],
          url: "https://example.com/webhooks/work-items",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const endpoint = await endpointResponse.json();
      const createResponse = await fetch(`${server.baseUrl}/api/work-items`, {
        body: JSON.stringify({
          spaceId: "space_platform",
          title: "Capture outbound webhook fanout",
          type: "Task",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();
      const updateResponse = await fetch(`${server.baseUrl}/api/work-items/${created.id}`, {
        body: JSON.stringify({
          state: "Done",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      expect(endpointResponse.status).toBe(201);
      expect(createResponse.status).toBe(201);
      expect(updateResponse.status).toBe(200);

      const deliveries = server.repository.listWebhookDeliveries(endpoint.id, 10);

      expect(deliveries).toHaveLength(2);
      expect(deliveries.map((delivery) => delivery.eventType).sort()).toEqual([
        "state.changed",
        "work-item.created",
      ]);
      expect(deliveries[0]?.payload.entityType).toBe("work-item");
      expect(deliveries[0]?.payload.data.workItem?.id).toBe(created.id);
    } finally {
      await server.close();
    }
  });

  it("enqueues signal and document webhook deliveries for subscribed endpoints", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_webhook_document_admin");

    try {
      const endpointResponse = await fetch(`${server.baseUrl}/api/webhooks`, {
        body: JSON.stringify({
          name: "Narrative feed",
          secret: "narrative-secret",
          subscribedEvents: ["signal.*", "document.*"],
          url: "https://example.com/webhooks/narrative",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const endpoint = await endpointResponse.json();
      const signalCreateResponse = await fetch(`${server.baseUrl}/api/signals`, {
        body: JSON.stringify({
          source: "Mikael",
          summary: "Pipe narrative events to other systems.",
          title: "Webhook narrative sync",
          urgency: "High",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const signal = await signalCreateResponse.json();
      const signalUpdateResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}`, {
        body: JSON.stringify({
          expectedTimeline: "This sprint",
          source: "Mikael",
          summary: "Pipe narrative events to other systems with clearer payloads.",
          title: "Webhook narrative sync",
          urgency: "Medium",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const signalPullResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}/pull`, {
        body: JSON.stringify({
          targetSpaceId: "space_platform",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const pulledWorkItem = await signalPullResponse.json();
      const documentCreateResponse = await fetch(`${server.baseUrl}/api/documents`, {
        body: JSON.stringify({
          title: "Webhook narrative sync",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const document = await documentCreateResponse.json();
      const linkResponse = await fetch(
        `${server.baseUrl}/api/work-items/${pulledWorkItem.id}/document-links`,
        {
          body: JSON.stringify({
            documentId: document.id,
          }),
          headers: {
            Cookie: adminCookie,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const documentUpdateResponse = await fetch(`${server.baseUrl}/api/documents/${document.id}`, {
        body: JSON.stringify({
          markdown: "# Webhook narrative sync\n\nUpdated for outbound delivery payloads.",
          summary: "Updated after promotion.",
          title: "Webhook narrative sync",
          type: "Evolution",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      expect(endpointResponse.status).toBe(201);
      expect(signalCreateResponse.status).toBe(201);
      expect(signalUpdateResponse.status).toBe(200);
      expect(signalPullResponse.status).toBe(201);
      expect(documentCreateResponse.status).toBe(201);
      expect(linkResponse.status).toBe(201);
      expect(documentUpdateResponse.status).toBe(200);

      const deliveries = server.repository.listWebhookDeliveries(endpoint.id, 20);

      expect(deliveries.map((delivery) => delivery.eventType).sort()).toEqual([
        "document.created",
        "document.linked",
        "document.updated",
        "signal.created",
        "signal.pulled",
        "signal.updated",
      ]);

      const signalCreated = deliveries.find((delivery) => delivery.eventType === "signal.created");
      const documentCreated = deliveries.find(
        (delivery) => delivery.eventType === "document.created",
      );

      expect(signalCreated?.payload.data.signal?.id).toBe(signal.id);
      expect(documentCreated?.payload.data.document?.id).toBe(document.id);
    } finally {
      await server.close();
    }
  });

  it("supports creating and pulling signals through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "signals_http_admin");

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/signals`, {
        body: JSON.stringify({
          expectedTimeline: "This quarter",
          summary: "Capture ideas globally, then let a space owner pull them into Inbox.",
          source: "Mikael",
          title: "Shared Signal flow",
          urgency: "High",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const signal = await createResponse.json();
      const pullResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}/pull`, {
        body: JSON.stringify({
          targetSpaceId: "space_product",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const pulled = await pullResponse.json();
      const archivedSignalResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const archivedSignal = await archivedSignalResponse.json();

      expect(createResponse.status).toBe(201);
      expect(pullResponse.status).toBe(201);
      expect(signal.status).toBe("Open");
      expect(signal.source).toBe("Mikael");
      expect(signal.urgency).toBe("High");
      expect(pulled.space.id).toBe("space_product");
      expect(pulled.state).toBe("Inbox");
      expect(archivedSignal.status).toBe("Pulled");
    } finally {
      await server.close();
    }
  });

  it("supports updating documents through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_document_update_admin");

    try {
      const listResponse = await fetch(`${server.baseUrl}/api/documents`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const [document] = await listResponse.json();
      const updateResponse = await fetch(`${server.baseUrl}/api/documents/${document.id}`, {
        body: JSON.stringify({
          markdown: "# Updated\n\n- Roadmap note",
          summary: "Updated through the API.",
          title: "Updated through HTTP",
          type: "Strategy",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updated = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updated.createdAt).toEqual(expect.any(String));
      expect(updated.updatedAt).toEqual(expect.any(String));
      expect(updated.title).toBe("Updated through HTTP");
      expect(updated.markdown).toContain("Roadmap note");
      expect(updated.type).toBe("Strategy");
    } finally {
      await server.close();
    }
  });

  it("supports deleting work items, signals, and documents through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "user_document_delete_admin");

    try {
      const signalCreateResponse = await fetch(`${server.baseUrl}/api/signals`, {
        body: JSON.stringify({
          source: "Mikael",
          summary: "Reopen the intake item if the pulled work item is later removed.",
          title: "Keep deleted pulled work recoverable",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const signal = await signalCreateResponse.json();
      const pullResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}/pull`, {
        body: JSON.stringify({
          targetSpaceId: "space_product",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const pulledWorkItem = await pullResponse.json();
      const deleteWorkItemResponse = await fetch(
        `${server.baseUrl}/api/work-items/${pulledWorkItem.id}`,
        {
          headers: {
            Cookie: adminCookie,
          },
          method: "DELETE",
        },
      );
      const deletedWorkItem = await deleteWorkItemResponse.json();
      const reopenedSignalResponse = await fetch(`${server.baseUrl}/api/signals/${signal.id}`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const reopenedSignal = await reopenedSignalResponse.json();

      const standaloneSignalCreateResponse = await fetch(`${server.baseUrl}/api/signals`, {
        body: JSON.stringify({
          source: "Lea",
          summary: "Signal that can be removed directly.",
          title: "Delete me",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const standaloneSignal = await standaloneSignalCreateResponse.json();
      const deleteSignalResponse = await fetch(
        `${server.baseUrl}/api/signals/${standaloneSignal.id}`,
        {
          headers: {
            Cookie: adminCookie,
          },
          method: "DELETE",
        },
      );
      const deletedSignal = await deleteSignalResponse.json();
      const signalsAfterDelete = await fetch(`${server.baseUrl}/api/signals`, {
        headers: {
          Cookie: adminCookie,
        },
      }).then((entry) => entry.json());

      const documentsResponse = await fetch(`${server.baseUrl}/api/documents`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const [document] = await documentsResponse.json();
      const deleteDocumentResponse = await fetch(`${server.baseUrl}/api/documents/${document.id}`, {
        headers: {
          Cookie: adminCookie,
        },
        method: "DELETE",
      });
      const deletedDocument = await deleteDocumentResponse.json();
      const documentsAfterDelete = await fetch(`${server.baseUrl}/api/documents`, {
        headers: {
          Cookie: adminCookie,
        },
      }).then((entry) => entry.json());

      expect(deleteWorkItemResponse.status).toBe(200);
      expect(deletedWorkItem.id).toBe(pulledWorkItem.id);
      expect(reopenedSignal.status).toBe("Open");
      expect(reopenedSignal.pulledIntoWorkItemId).toBeNull();

      expect(deleteSignalResponse.status).toBe(200);
      expect(deletedSignal.id).toBe(standaloneSignal.id);
      expect(
        signalsAfterDelete.some((entry: { id: string }) => entry.id === standaloneSignal.id),
      ).toBe(false);

      expect(deleteDocumentResponse.status).toBe(200);
      expect(deletedDocument.id).toBe(document.id);
      expect(documentsAfterDelete.some((entry: { id: string }) => entry.id === document.id)).toBe(
        false,
      );
    } finally {
      await server.close();
    }
  });

  it("supports creating and managing spaces and horizons through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "spaces_and_horizons_admin");

    try {
      const createSpaceResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        body: JSON.stringify({
          accent: "#0f766e",
          description: "Internal systems and shared platform work.",
          name: "Operations Core",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const space = await createSpaceResponse.json();
      const updateSpaceResponse = await fetch(`${server.baseUrl}/api/spaces/${space.id}`, {
        body: JSON.stringify({
          description: "Shared platform and internal systems work.",
          name: "Platform Core",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updatedSpace = await updateSpaceResponse.json();
      const horizonsResponse = await fetch(`${server.baseUrl}/api/horizons`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const horizons = await horizonsResponse.json();
      const nowHorizon = horizons.find(
        (entry: { name: string; spaceId: string }) =>
          entry.spaceId === space.id && entry.name === "Now",
      );
      const updateHorizonResponse = await fetch(`${server.baseUrl}/api/horizons/${nowHorizon.id}`, {
        body: JSON.stringify({
          description: "Immediate platform priorities.",
          label: "Now",
          windowEndDays: 14,
          windowStartDays: 0,
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updatedHorizon = await updateHorizonResponse.json();

      expect(createSpaceResponse.status).toBe(201);
      expect(updateSpaceResponse.status).toBe(200);
      expect(updateHorizonResponse.status).toBe(200);
      expect(updatedSpace.name).toBe("Platform Core");
      expect(updatedHorizon.description).toBe("Immediate platform priorities.");
      expect(
        horizons.filter((entry: { spaceId: string }) => entry.spaceId === space.id),
      ).toHaveLength(3);
    } finally {
      await server.close();
    }
  });

  it("supports creating, updating, and auditing API identities through HTTP", async () => {
    const server = await createTestServer();
    const { adminCookie } = createAdminSession(server, "api_identities_admin");

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/api-identities`, {
        body: JSON.stringify({
          description: "Automates dependency refreshes for shared services.",
          name: "Dependency Bot",
          permissions: {
            boards: {
              grants: [
                {
                  boardId: "space_platform",
                  level: "editor",
                },
              ],
              scope: "boards",
            },
            documents: "editor",
            signals: "viewer",
          },
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();
      const updateResponse = await fetch(
        `${server.baseUrl}/api/api-identities/${created.apiIdentity.id}`,
        {
          body: JSON.stringify({
            permissions: {
              boards: {
                level: "admin",
                scope: "all",
              },
              documents: "admin",
              signals: "editor",
            },
            status: "Paused",
          }),
          headers: {
            Cookie: adminCookie,
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const updated = await updateResponse.json();
      const pausedAuthResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        headers: {
          Authorization: `Bearer ${created.token}`,
        },
      });
      const rotateResponse = await fetch(
        `${server.baseUrl}/api/api-identities/${created.apiIdentity.id}/rotate-token`,
        {
          headers: {
            Cookie: adminCookie,
          },
          method: "POST",
        },
      );
      const rotated = await rotateResponse.json();
      const oldTokenResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        headers: {
          Authorization: `Bearer ${created.token}`,
        },
      });
      const reactivateResponse = await fetch(
        `${server.baseUrl}/api/api-identities/${created.apiIdentity.id}`,
        {
          body: JSON.stringify({
            status: "Active",
          }),
          headers: {
            Cookie: adminCookie,
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const newTokenResponse = await fetch(`${server.baseUrl}/api/spaces`, {
        headers: {
          Authorization: `Bearer ${rotated.token}`,
        },
      });
      const listResponse = await fetch(`${server.baseUrl}/api/api-identities`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const identities = await listResponse.json();

      expect(createResponse.status).toBe(201);
      expect(updateResponse.status).toBe(200);
      expect(pausedAuthResponse.status).toBe(403);
      expect(rotateResponse.status).toBe(201);
      expect(oldTokenResponse.status).toBe(401);
      expect(reactivateResponse.status).toBe(200);
      expect(newTokenResponse.status).toBe(200);
      expect(created.apiIdentity.lastUsedAt).toBeNull();
      expect(created.token).toEqual(expect.any(String));
      expect(created.apiIdentity.permissions.boards.scope).toBe("boards");
      expect(updated.status).toBe("Paused");
      expect(updated.permissions.boards.scope).toBe("all");
      expect(updated.permissions.documents).toBe("admin");
      expect(rotated.apiIdentity.tokenLastRotatedAt).toEqual(expect.any(String));
      expect(
        identities.find((entry: { id: string }) => entry.id === created.apiIdentity.id)?.lastUsedAt,
      ).toEqual(expect.any(String));
    } finally {
      await server.close();
    }
  });

  it("supports inviting, listing, verifying, and deleting users through HTTP", async () => {
    const server = await createTestServer();
    const now = new Date().toISOString();
    const adminUser = User.invite({
      email: "owner@example.com",
      id: "user_invite_admin",
      now,
      role: "Admin",
    })
      .recordSignIn(now)
      .toDTO();
    const adminCookie = server.sessionSecurity.createSessionCookie(adminUser);

    server.repository.saveUser(adminUser);

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/users`, {
        body: JSON.stringify({
          email: "sam.person@example.com",
          name: "Sam Person",
          permissions: {
            boards: {
              grants: [
                {
                  boardId: "space_product",
                  level: "editor",
                },
              ],
              scope: "boards",
            },
            documents: "viewer",
            signals: "editor",
          },
          role: "Admin",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();
      const inviteEmail = server.mailer.messages.at(-1);

      expect(createResponse.status).toBe(201);
      expect(created.email).toBe("sam.person@example.com");
      expect(created.permissions.boards.scope).toBe("boards");
      expect(created.role).toBe("Admin");
      expect(created.status).toBe("Invited");
      expect(inviteEmail?.to).toBe("sam.person@example.com");
      expect(inviteEmail?.subject).toContain("invited");

      const inviteUrl = inviteEmail?.text.match(/https?:\/\/\S+/)?.[0];

      expect(inviteUrl).toBeTruthy();

      const verifyResponse = await fetch(inviteUrl as string, {
        redirect: "manual",
      });

      expect(verifyResponse.status).toBe(302);
      expect(verifyResponse.headers.get("location")).toContain("auth=success");
      expect(verifyResponse.headers.get("location")).toContain("email=sam.person%40example.com");

      const usersResponse = await fetch(`${server.baseUrl}/api/users`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const users = await usersResponse.json();
      const verifiedUser = users.find((entry: { id: string }) => entry.id === created.id);

      expect(usersResponse.status).toBe(200);
      expect(verifiedUser.status).toBe("Active");
      expect(verifiedUser.activatedAt).toEqual(expect.any(String));
      expect(verifiedUser.lastSignedInAt).toEqual(expect.any(String));

      const updateResponse = await fetch(`${server.baseUrl}/api/users/${created.id}`, {
        body: JSON.stringify({
          name: "Sam Steward",
          permissions: {
            boards: {
              level: null,
              scope: "all",
            },
            documents: "editor",
            signals: null,
          },
          role: "User",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const updated = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updated.name).toBe("Sam Steward");
      expect(updated.role).toBe("User");
      expect(updated.permissions.boards.scope).toBe("all");
      expect(updated.permissions.boards.level).toBeNull();
      expect(updated.permissions.signals).toBeNull();

      const loginResponse = await fetch(`${server.baseUrl}/auth/login`, {
        body: JSON.stringify({
          email: "sam.person@example.com",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const loginPayload = await loginResponse.json();

      expect(loginResponse.status).toBe(200);
      expect(loginPayload.message).toContain("sign-in link");
      expect(server.mailer.messages.at(-1)?.subject).toContain("Sign in");

      const deleteResponse = await fetch(`${server.baseUrl}/api/users/${created.id}`, {
        headers: {
          Cookie: adminCookie,
        },
        method: "DELETE",
      });
      const deleted = await deleteResponse.json();
      const listAfterDeleteResponse = await fetch(`${server.baseUrl}/api/users`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const listAfterDelete = await listAfterDeleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleted.id).toBe(created.id);
      expect(listAfterDelete.some((entry: { id: string }) => entry.id === created.id)).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("supports signing in invited users with OAuth SSO", async () => {
    const appPort = await getAvailablePort();
    const oauthProvider = await createMockOAuthProviderServer({
      email: "sam.person@example.com",
    });
    const appUrl = `http://127.0.0.1:${appPort}`;
    const providerConfig = {
      authorizationUrl: `${oauthProvider.baseUrl}/authorize`,
      clientId: "mikrolens-client",
      clientSecret: "mikrolens-secret",
      id: "acme",
      name: "Acme SSO",
      redirectUri: `${appUrl}/auth/oauth/acme/callback`,
      scopes: "openid email profile",
      tokenUrl: `${oauthProvider.baseUrl}/token`,
      userInfoUrl: `${oauthProvider.baseUrl}/userinfo`,
    };
    const server = await createTestServer({
      appUrl,
      oauth: {
        custom: [providerConfig],
        stateExpirySeconds: 60,
      },
      oauthProviders: [providerConfig],
      port: appPort,
    });
    const now = new Date().toISOString();
    const adminUser = User.invite({
      email: "owner@example.com",
      id: "user_oauth_admin",
      now,
      role: "Admin",
    })
      .recordSignIn(now)
      .toDTO();
    const adminCookie = server.sessionSecurity.createSessionCookie(adminUser);

    server.repository.saveUser(adminUser);

    try {
      const createResponse = await fetch(`${server.baseUrl}/api/users`, {
        body: JSON.stringify({
          email: "sam.person@example.com",
          name: "Sam Person",
          role: "User",
        }),
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const created = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(created.status).toBe("Invited");

      const providersResponse = await fetch(`${server.baseUrl}/auth/oauth/providers`);
      const providersPayload = await providersResponse.json();

      expect(providersResponse.status).toBe(200);
      expect(providersPayload.providers).toEqual([
        {
          id: "acme",
          loginUrl: "/auth/oauth/acme",
          name: "Acme SSO",
        },
      ]);

      const oauthResponse = await fetch(`${server.baseUrl}/auth/oauth/acme`, {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
        redirect: "manual",
      });

      expect(oauthResponse.status).toBe(302);

      const providerLocation = oauthResponse.headers.get("location");

      expect(providerLocation).toContain(`${oauthProvider.baseUrl}/authorize`);

      const callbackResponse = await fetch(providerLocation as string, {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
        redirect: "manual",
      });

      expect(callbackResponse.status).toBe(302);

      const appCallbackLocation = callbackResponse.headers.get("location");
      const appRedirectResponse = await fetch(appCallbackLocation as string, {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
        redirect: "manual",
      });

      expect(appRedirectResponse.status).toBe(302);
      expect(appRedirectResponse.headers.get("location")).toContain("auth=success");
      expect(appRedirectResponse.headers.get("location")).toContain(
        "email=sam.person%40example.com",
      );

      const usersResponse = await fetch(`${server.baseUrl}/api/users`, {
        headers: {
          Cookie: adminCookie,
        },
      });
      const users = await usersResponse.json();
      const verifiedUser = users.find((entry: { id: string }) => entry.id === created.id);

      expect(verifiedUser.status).toBe("Active");
      expect(verifiedUser.activatedAt).toEqual(expect.any(String));
      expect(verifiedUser.lastSignedInAt).toEqual(expect.any(String));
    } finally {
      await server.close();
      await oauthProvider.close();
    }
  });

  it("uses the public API origin for magic links and the frontend origin for auth redirects", async () => {
    const server = await createTestServer({
      appUrl: "https://app.example.com",
    });
    const now = new Date().toISOString();
    const loginEmail = "split-origin@example.com";
    const invitedUser = User.invite({
      email: loginEmail,
      id: "user_split_origin_magic_link",
      now,
      role: "User",
    }).toDTO();

    server.repository.saveUser(invitedUser);

    try {
      const loginResponse = await sendRawHttpRequest({
        body: JSON.stringify({
          email: loginEmail,
        }),
        headers: {
          "content-type": "application/json",
          host: "api.example.com",
          origin: "https://app.example.com",
          "x-forwarded-proto": "https",
        },
        hostname: "127.0.0.1",
        method: "POST",
        path: "/auth/login",
        port: Number(new URL(server.baseUrl).port),
      });

      expect(loginResponse.statusCode).toBe(200);
      expect(server.mailer.messages).toHaveLength(1);

      const text = server.mailer.messages[0]?.text ?? "";
      const magicLink = text.match(/https?:\/\/\S+/)?.[0] ?? "";

      expect(magicLink).toContain("https://app.example.com/auth/verify");

      const verifyUrl = new URL(magicLink);
      const verifyResponse = await sendRawHttpRequest({
        headers: {
          host: "api.example.com",
          "x-forwarded-proto": "https",
        },
        hostname: "127.0.0.1",
        method: "GET",
        path: `${verifyUrl.pathname}${verifyUrl.search}`,
        port: Number(new URL(server.baseUrl).port),
      });

      expect(verifyResponse.statusCode).toBe(302);
      expect(readHeader(verifyResponse.headers, "set-cookie")).toContain("SameSite=None");
      expect(readHeader(verifyResponse.headers, "set-cookie")).toContain("Secure");
      expect(verifyResponse.headers.location).toContain("https://app.example.com/?auth=success");
      expect(verifyResponse.headers.location).toContain("access_token=");
      expect(verifyResponse.headers.location).toContain("refresh_token=");
    } finally {
      await server.close();
    }
  });
});

async function createMockOAuthProviderServer(options: { email: string }) {
  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end();
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");

      if (!redirectUri || !state) {
        response.statusCode = 400;
        response.end();
        return;
      }

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", "oauth-code");
      callbackUrl.searchParams.set("state", state);
      response.statusCode = 302;
      response.setHeader("location", callbackUrl.toString());
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/token") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          access_token: "provider-access-token",
          token_type: "Bearer",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/userinfo") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          email: options.email,
          name: "Sam Person",
          sub: "oauth-user-1",
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function getAvailablePort() {
  const server = createServer();

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return address.port;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name];

  if (Array.isArray(value)) {
    return value.join("; ");
  }

  return value ?? "";
}

async function sendRawHttpRequest(options: HttpRequestOptions & { body?: string }): Promise<{
  body: string;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}> {
  return new Promise((resolve, reject) => {
    const request = sendHttpRequest(options, (response) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          headers: response.headers,
          statusCode: response.statusCode ?? 0,
        });
      });
    });

    request.on("error", reject);

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}
