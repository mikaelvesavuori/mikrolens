import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type RecordActor,
  resolveRecordAccessPolicy,
} from "../../application/policies/recordAccess.ts";
import type { MikroLensRepository } from "../../application/ports/MikroLensRepository.ts";
import type { MagicLinkService } from "../../application/services/MagicLinkService.ts";
import { rotateApiIdentityToken } from "../../application/usecases/apiIdentities/rotateApiIdentityToken.ts";
import { deleteUser } from "../../application/usecases/users/deleteUser.ts";
import { createWebhookEndpoint } from "../../application/usecases/webhooks/createWebhookEndpoint.ts";
import { deleteWebhookEndpoint } from "../../application/usecases/webhooks/deleteWebhookEndpoint.ts";
import { getWebhookDeliveries } from "../../application/usecases/webhooks/getWebhookDeliveries.ts";
import { listWebhookEndpoints } from "../../application/usecases/webhooks/listWebhookEndpoints.ts";
import { updateWebhookEndpoint } from "../../application/usecases/webhooks/updateWebhookEndpoint.ts";
import { canAccessBoard } from "../../domain/AccessPolicy.ts";
import { hasUserPermission, MIKROLENS_PERMISSIONS } from "../../domain/Authorization.ts";
import type { UserDTO } from "../../domain/User.ts";
import { AuthenticationError, AuthorizationError } from "../../errors/MikroLensError.ts";
import { parseWebhookSubscriptions, sanitizeWebhookEndpoint } from "./httpAdapters.ts";
import { readJsonBody, sendJson, sendNoContent } from "./httpUtils.ts";
import { createApiIdentityFromInput } from "./inputs/createApiIdentityFromInput.ts";
import { createHorizonFromInput } from "./inputs/createHorizonFromInput.ts";
import { createSpaceFromInput } from "./inputs/createSpaceFromInput.ts";
import { inviteUserFromInput } from "./inputs/inviteUserFromInput.ts";
import { updateApiIdentityFromInput } from "./inputs/updateApiIdentityFromInput.ts";
import { updateHorizonDefaultFromInput } from "./inputs/updateHorizonDefaultFromInput.ts";
import { updateHorizonFromInput } from "./inputs/updateHorizonFromInput.ts";
import { updateSpaceFromInput } from "./inputs/updateSpaceFromInput.ts";
import { updateUserFromInput } from "./inputs/updateUserFromInput.ts";

export interface HandleConfigurationRoutesHttpOptions {
  apiUrl: string;
  currentActor: RecordActor | null;
  currentUser: UserDTO | null;
  magicLinkService: Pick<MagicLinkService, "sendInvite">;
  pathname: string;
  repository: MikroLensRepository;
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
}

/**
 * @description Handle configuration-oriented HTTP routes by delegating to application use cases.
 */
export async function handleConfigurationRoutesHttp(
  options: HandleConfigurationRoutesHttpOptions,
): Promise<boolean> {
  const {
    apiUrl,
    currentActor,
    currentUser,
    magicLinkService,
    pathname,
    repository,
    request,
    response,
    url,
  } = options;

  if (
    await handleSpaceRoutesHttp({
      currentActor,
      currentUser,
      pathname,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  if (
    await handleHorizonRoutesHttp({
      currentActor,
      currentUser,
      pathname,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  if (
    await handleHorizonDefaultRoutesHttp({
      currentActor,
      currentUser,
      pathname,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  if (request.method === "GET" && pathname === "/api/views") {
    resolveRecordAccessPolicy(repository, currentActor);
    sendJson(response, 200, repository.listViews());
    return true;
  }

  if (
    await handleWebhookRoutesHttp({
      currentActor,
      currentUser,
      pathname,
      repository,
      request,
      response,
      url,
    })
  ) {
    return true;
  }

  if (
    await handleApiIdentityRoutesHttp({
      currentActor,
      currentUser,
      pathname,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  if (
    await handleUserRoutesHttp({
      apiUrl,
      currentActor,
      currentUser,
      magicLinkService,
      pathname,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  return false;
}

interface BasicRoutesHttpOptions {
  currentActor: RecordActor | null;
  currentUser: UserDTO | null;
  pathname: string;
  repository: MikroLensRepository;
  request: IncomingMessage;
  response: ServerResponse;
}

async function handleSpaceRoutesHttp(options: BasicRoutesHttpOptions): Promise<boolean> {
  const { currentActor, currentUser, pathname, repository, request, response } = options;

  if (request.method === "GET" && pathname === "/api/spaces") {
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);

    sendJson(
      response,
      200,
      repository.listSpaces().filter((space) => canAccessBoard(accessPolicy, space.id, "viewer")),
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/spaces") {
    requireConfigurationAdmin(currentUser);
    const body = await readJsonBody<{
      accent?: string;
      description?: string;
      name?: string;
    }>(request);

    sendJson(response, 201, createSpaceFromInput(repository, body));

    return true;
  }

  if (pathname.startsWith("/api/spaces/") && request.method === "PATCH") {
    requireConfigurationAdmin(currentUser);
    const spaceId = pathname.replace("/api/spaces/", "");
    const body = await readJsonBody<{
      accent?: string;
      description?: string;
      name?: string;
    }>(request);

    sendJson(response, 200, updateSpaceFromInput(repository, { ...body, id: spaceId }));

    return true;
  }

  return false;
}

async function handleHorizonRoutesHttp(options: BasicRoutesHttpOptions): Promise<boolean> {
  const { currentActor, currentUser, pathname, repository, request, response } = options;

  if (request.method === "GET" && pathname === "/api/horizons") {
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);

    sendJson(
      response,
      200,
      repository
        .listHorizons()
        .filter((horizon) => canAccessBoard(accessPolicy, horizon.spaceId, "viewer")),
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/horizons") {
    requireConfigurationAdmin(currentUser);
    const body = await readJsonBody<{
      key?: string;
      spaceId?: string;
    }>(request);

    sendJson(response, 201, createHorizonFromInput(repository, body));

    return true;
  }

  if (pathname.startsWith("/api/horizons/") && request.method === "PATCH") {
    requireConfigurationAdmin(currentUser);
    const horizonId = pathname.replace("/api/horizons/", "");
    const body = await readJsonBody<{
      description?: string;
      label?: string;
      timeframeText?: string;
      useDefaults?: boolean;
    }>(request);

    sendJson(response, 200, updateHorizonFromInput(repository, { ...body, id: horizonId }));

    return true;
  }

  return false;
}

async function handleHorizonDefaultRoutesHttp(options: BasicRoutesHttpOptions): Promise<boolean> {
  const { currentUser, pathname, repository, request, response } = options;

  if (request.method === "GET" && pathname === "/api/horizon-defaults") {
    requireConfigurationAdmin(currentUser);
    sendJson(response, 200, repository.listHorizonDefaults());
    return true;
  }

  if (pathname.startsWith("/api/horizon-defaults/") && request.method === "PATCH") {
    requireConfigurationAdmin(currentUser);
    const key = pathname.replace("/api/horizon-defaults/", "");
    const body = await readJsonBody<{
      description?: string;
      label?: string;
      timeframeText?: string;
    }>(request);

    sendJson(response, 200, updateHorizonDefaultFromInput(repository, { ...body, key }));
    return true;
  }

  return false;
}

async function handleWebhookRoutesHttp(
  options: BasicRoutesHttpOptions & {
    url: URL;
  },
): Promise<boolean> {
  const { currentUser, pathname, repository, request, response, url } = options;

  if (request.method === "GET" && pathname === "/api/webhooks") {
    requireConfigurationAdmin(currentUser);
    sendJson(response, 200, listWebhookEndpoints(repository).map(sanitizeWebhookEndpoint));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/webhooks") {
    requireConfigurationAdmin(currentUser);
    const body = await readJsonBody<{
      name?: string;
      secret?: string;
      spaceId?: string | null;
      status?: string;
      subscribedEvents?: unknown;
      url?: string;
    }>(request);
    const name = body.name?.trim() ?? "";
    const secret = body.secret?.trim() ?? "";
    const urlValue = body.url?.trim() ?? "";
    const subscribedEvents = parseWebhookSubscriptions(body.subscribedEvents);

    const endpoint = createWebhookEndpoint(repository, {
      name,
      secret,
      spaceId: body.spaceId,
      status: body.status,
      subscribedEvents,
      url: urlValue,
    });
    sendJson(response, 201, sanitizeWebhookEndpoint(endpoint));
    return true;
  }

  if (
    pathname.startsWith("/api/webhooks/") &&
    pathname.endsWith("/deliveries") &&
    request.method === "GET"
  ) {
    requireConfigurationAdmin(currentUser);
    const endpointId = pathname
      .replace("/api/webhooks/", "")
      .replace("/deliveries", "")
      .replace(/\/$/, "");

    sendJson(
      response,
      200,
      getWebhookDeliveries(repository, {
        endpointId,
        limit: Number.parseInt(url.searchParams.get("limit") ?? "50", 10),
      }),
    );

    return true;
  }

  if (pathname.startsWith("/api/webhooks/") && request.method === "PATCH") {
    requireConfigurationAdmin(currentUser);
    const endpointId = pathname.replace("/api/webhooks/", "");
    const body = await readJsonBody<{
      name?: string;
      secret?: string;
      spaceId?: string | null;
      status?: string;
      subscribedEvents?: unknown;
      url?: string;
    }>(request);

    const updated = updateWebhookEndpoint(repository, {
      id: endpointId,
      name: body.name,
      secret: body.secret,
      spaceId: body.spaceId,
      status: body.status,
      subscribedEvents:
        body.subscribedEvents === undefined
          ? undefined
          : parseWebhookSubscriptions(body.subscribedEvents),
      url: body.url,
    });
    sendJson(response, 200, sanitizeWebhookEndpoint(updated));
    return true;
  }

  if (pathname.startsWith("/api/webhooks/") && request.method === "DELETE") {
    requireConfigurationAdmin(currentUser);
    const endpointId = pathname.replace("/api/webhooks/", "");
    deleteWebhookEndpoint(repository, endpointId);
    sendNoContent(response);
    return true;
  }

  return false;
}

async function handleApiIdentityRoutesHttp(options: BasicRoutesHttpOptions): Promise<boolean> {
  const { currentUser, pathname, repository, request, response } = options;

  if (request.method === "GET" && pathname === "/api/api-identities") {
    requireConfigurationAdmin(currentUser);
    sendJson(response, 200, repository.listApiIdentities());
    return true;
  }

  if (request.method === "POST" && pathname === "/api/api-identities") {
    requireConfigurationAdmin(currentUser);
    const body = await readJsonBody<{
      description?: string;
      name?: string;
      permissions?: unknown;
      status?: string;
    }>(request);

    sendJson(response, 201, createApiIdentityFromInput(repository, body));

    return true;
  }

  if (
    request.method === "POST" &&
    pathname.endsWith("/rotate-token") &&
    pathname.startsWith("/api/api-identities/")
  ) {
    requireConfigurationAdmin(currentUser);
    const apiIdentityId = pathname
      .replace("/api/api-identities/", "")
      .replace("/rotate-token", "")
      .replace(/\/$/, "");
    const updated = rotateApiIdentityToken(repository, apiIdentityId);

    sendJson(response, 201, updated);
    return true;
  }

  if (pathname.startsWith("/api/api-identities/") && request.method === "PATCH") {
    requireConfigurationAdmin(currentUser);
    const apiIdentityId = pathname.replace("/api/api-identities/", "");
    const body = await readJsonBody<{
      description?: string;
      name?: string;
      permissions?: unknown;
      status?: string;
    }>(request);

    sendJson(response, 200, updateApiIdentityFromInput(repository, { ...body, id: apiIdentityId }));

    return true;
  }

  return false;
}

async function handleUserRoutesHttp(
  options: BasicRoutesHttpOptions & {
    apiUrl: string;
    magicLinkService: Pick<MagicLinkService, "sendInvite">;
  },
): Promise<boolean> {
  const {
    apiUrl,
    currentActor,
    currentUser,
    magicLinkService,
    pathname,
    repository,
    request,
    response,
  } = options;

  if (request.method === "GET" && pathname === "/api/users") {
    requireConfigurationAdmin(currentUser);
    sendJson(response, 200, repository.listUsers());
    return true;
  }

  if (request.method === "POST" && pathname === "/api/users") {
    requireConfigurationAdmin(currentUser);
    const body = await readJsonBody<{
      email?: string;
      name?: string;
      permissions?: unknown;
      role?: string;
    }>(request);

    const created = await inviteUserFromInput(repository, magicLinkService, apiUrl, body);
    sendJson(response, 201, created);

    return true;
  }

  if (pathname.startsWith("/api/users/") && request.method === "PATCH") {
    const userId = pathname.replace("/api/users/", "");
    const body = await readJsonBody<{
      name?: string | null;
      permissions?: unknown;
      role?: string;
    }>(request);
    const isSelfUpdate = currentActor?.kind === "user" && currentActor.user.id === userId;
    const changesRoleOrPermissions =
      Object.hasOwn(body, "permissions") || Object.hasOwn(body, "role");

    if (isSelfUpdate && !changesRoleOrPermissions) {
      if (!currentUser) {
        throw new AuthenticationError("Sign in is required.");
      }
    } else {
      requireConfigurationAdmin(currentUser);
    }

    if (isSelfUpdate && changesRoleOrPermissions) {
      throw new AuthorizationError("You cannot change your own role or permissions.");
    }

    sendJson(response, 200, updateUserFromInput(repository, { ...body, id: userId }));

    return true;
  }

  if (pathname.startsWith("/api/users/") && request.method === "DELETE") {
    requireConfigurationAdmin(currentUser);
    const userId = pathname.replace("/api/users/", "");

    if (currentUser?.id === userId) {
      throw new AuthorizationError("You cannot delete your own account.");
    }

    sendJson(response, 200, deleteUser(repository, userId));
    return true;
  }

  return false;
}

function requireConfigurationAdmin(currentUser: UserDTO | null): void {
  if (!currentUser) {
    throw new AuthenticationError("Sign in is required.");
  }

  if (!hasUserPermission(currentUser, MIKROLENS_PERMISSIONS.settings.manage)) {
    throw new AuthorizationError("Admin access is required.");
  }
}
