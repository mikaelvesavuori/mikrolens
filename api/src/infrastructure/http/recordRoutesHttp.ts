import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type RecordActor,
  requireBoardAccess,
  requireDocumentAccess,
  requireSignalAccess,
  resolveRecordAccessPolicy,
} from "../../application/policies/recordAccess.ts";
import type { MikroLensRepository } from "../../application/ports/MikroLensRepository.ts";
import { buildDocumentDetail } from "../../application/queries/DocumentDetail.ts";
import {
  buildDocumentSummaries,
  buildSignalRecords,
  buildWorkItemRecords,
  findSignalRecord,
  findWorkItemRecord,
} from "../../application/queries/LedgerReadModels.ts";
import { deleteDocument } from "../../application/usecases/documents/deleteDocument.ts";
import { deleteSignal } from "../../application/usecases/signals/deleteSignal.ts";
import { deleteWorkItem } from "../../application/usecases/workItems/deleteWorkItem.ts";
import type { DocumentCollaborationHub } from "../collaboration/DocumentCollaborationHub.ts";
import { handleDocumentCollaborationHttp } from "./documentCollaborationHttp.ts";
import { getWorkItemFilters } from "./httpAdapters.ts";
import { readJsonBody, sendError, sendJson } from "./httpUtils.ts";
import { createDocumentFromInput } from "./inputs/createDocumentFromInput.ts";
import { createSignalFromInput } from "./inputs/createSignalFromInput.ts";
import { createWorkItemFromInput } from "./inputs/createWorkItemFromInput.ts";
import { linkDocumentToWorkItemFromInput } from "./inputs/linkDocumentToWorkItemFromInput.ts";
import { pullSignalToSpaceFromInput } from "./inputs/pullSignalToSpaceFromInput.ts";
import { unlinkDocumentFromWorkItemFromInput } from "./inputs/unlinkDocumentFromWorkItemFromInput.ts";
import { updateDocumentFromInput } from "./inputs/updateDocumentFromInput.ts";
import { updateSignalFromInput } from "./inputs/updateSignalFromInput.ts";
import { updateWorkItemFromInput } from "./inputs/updateWorkItemFromInput.ts";

export interface HandleRecordRoutesHttpOptions {
  baseUrl: string;
  collaborationHub: DocumentCollaborationHub;
  currentActor: RecordActor | null;
  pathname: string;
  repository: MikroLensRepository;
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
}

/**
 * @description Handle record-oriented HTTP routes by delegating to application use cases and query models.
 */
export async function handleRecordRoutesHttp(
  options: HandleRecordRoutesHttpOptions,
): Promise<boolean> {
  if (await handleDocumentRoutesHttp(options)) {
    return true;
  }

  if (await handleWorkItemRoutesHttp(options)) {
    return true;
  }

  if (await handleSignalRoutesHttp(options)) {
    return true;
  }

  return false;
}

async function handleDocumentRoutesHttp(options: HandleRecordRoutesHttpOptions): Promise<boolean> {
  const { baseUrl, collaborationHub, currentActor, pathname, repository, request, response, url } =
    options;

  if (request.method === "GET" && pathname === "/api/documents") {
    requireDocumentAccess(repository, currentActor, "viewer");
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    sendJson(
      response,
      200,
      buildDocumentSummaries(
        repository.getLedger(),
        {
          spaceId: url.searchParams.get("spaceId") ?? undefined,
        },
        accessPolicy,
      ),
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/documents") {
    requireDocumentAccess(repository, currentActor, "editor");
    const body = await readJsonBody<{
      horizonId?: string | null;
      markdown?: string;
      spaceId?: string;
      summary?: string;
      title?: string;
      type?: string;
    }>(request);

    sendJson(response, 201, createDocumentFromInput(repository, body));
    return true;
  }

  if (!pathname.startsWith("/api/documents/")) {
    return false;
  }

  const documentPath = pathname.replace("/api/documents/", "");
  const slashIndex = documentPath.indexOf("/");
  const documentId = slashIndex === -1 ? documentPath : documentPath.slice(0, slashIndex);
  const tail = slashIndex === -1 ? "" : documentPath.slice(slashIndex + 1);

  if (tail.startsWith("collaboration")) {
    requireDocumentAccess(
      repository,
      currentActor,
      request.method === "POST" && tail === "collaboration/draft" ? "editor" : "viewer",
    );
  }

  if (
    await handleDocumentCollaborationHttp({
      baseUrl,
      collaborationHub,
      documentPath,
      repository,
      request,
      response,
    })
  ) {
    return true;
  }

  if (request.method === "GET") {
    requireDocumentAccess(repository, currentActor, "viewer");
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    const detail = buildDocumentDetail(repository, documentId, accessPolicy);

    if (!detail) {
      sendError(response, 404, "Document not found.");
      return true;
    }

    sendJson(response, 200, detail);
    return true;
  }

  if (request.method === "PATCH") {
    requireDocumentAccess(repository, currentActor, "editor");
    const body = await readJsonBody<{
      clientId?: string;
      horizonId?: string | null;
      markdown?: string;
      summary?: string;
      title?: string;
      type?: string;
    }>(request);

    const updated = updateDocumentFromInput(repository, {
      horizonId: body.horizonId,
      id: documentId,
      markdown: body.markdown,
      summary: body.summary,
      title: body.title,
      type: body.type,
    });
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    const detail = buildDocumentDetail(repository, updated.id, accessPolicy);

    if (!detail) {
      sendError(response, 404, "Document not found.");
      return true;
    }

    collaborationHub.syncSavedDocument(updated.id, detail, body.clientId?.trim() ?? "");
    sendJson(response, 200, detail);
    return true;
  }

  if (request.method === "DELETE") {
    requireDocumentAccess(repository, currentActor, "editor");
    sendJson(response, 200, deleteDocument(repository, documentId));
    return true;
  }

  return false;
}

async function handleWorkItemRoutesHttp(options: HandleRecordRoutesHttpOptions): Promise<boolean> {
  const { currentActor, pathname, repository, request, response, url } = options;

  if (request.method === "GET" && pathname === "/api/work-items") {
    const filters = getWorkItemFilters(url);
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    const workItems = buildWorkItemRecords(repository.getLedger(), filters, accessPolicy);
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? workItems.length;

    sendJson(response, 200, workItems.slice(offset, offset + limit), {
      "X-Limit": String(limit),
      "X-Offset": String(offset),
      "X-Total-Count": String(workItems.length),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/work-items") {
    const body = await readJsonBody<{
      horizonId?: string;
      ownerName?: string | null;
      ownerUserIds?: string[];
      source?: "planned" | "unplanned";
      spaceId?: string;
      state?: string;
      summary?: string;
      targetEndDate?: string | null;
      targetStartDate?: string | null;
      title?: string;
      type?: string;
    }>(request);
    const spaceId = String(body.spaceId ?? "").trim();

    if (spaceId) {
      requireBoardAccess(repository, currentActor, spaceId, "editor");
    }

    sendJson(response, 201, createWorkItemFromInput(repository, body));

    return true;
  }

  if (
    request.method === "DELETE" &&
    pathname.includes("/document-links/") &&
    pathname.startsWith("/api/work-items/")
  ) {
    const match = pathname.match(/^\/api\/work-items\/([^/]+)\/document-links\/([^/]+)\/?$/);

    if (!match) {
      sendError(response, 404, "Work item document link not found.");
      return true;
    }

    const [, workItemId, documentId] = match;
    const workItem = repository.getWorkItem(workItemId);

    if (!workItem) {
      sendError(response, 404, "Work item not found.");
      return true;
    }

    requireBoardAccess(repository, currentActor, workItem.spaceId, "editor");
    requireDocumentAccess(repository, currentActor, "viewer");

    sendJson(
      response,
      200,
      unlinkDocumentFromWorkItemFromInput(repository, { documentId, workItemId }),
    );

    return true;
  }

  if (
    request.method === "POST" &&
    pathname.endsWith("/document-links") &&
    pathname.startsWith("/api/work-items/")
  ) {
    const workItemId = pathname
      .replace("/api/work-items/", "")
      .replace("/document-links", "")
      .replace(/\/$/, "");
    const workItem = repository.getWorkItem(workItemId);

    if (!workItem) {
      sendError(response, 404, "Work item not found.");
      return true;
    }

    requireBoardAccess(repository, currentActor, workItem.spaceId, "editor");
    requireDocumentAccess(repository, currentActor, "viewer");

    const body = await readJsonBody<{ documentId?: string }>(request);

    sendJson(response, 201, linkDocumentToWorkItemFromInput(repository, { ...body, workItemId }));

    return true;
  }

  if (!pathname.startsWith("/api/work-items/")) {
    return false;
  }

  const workItemId = pathname.replace("/api/work-items/", "");

  if (request.method === "GET") {
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    const workItem = findWorkItemRecord(repository.getLedger(), workItemId, accessPolicy);

    if (!workItem) {
      sendError(response, 404, "Work item not found.");
      return true;
    }

    sendJson(response, 200, workItem);
    return true;
  }

  if (request.method === "PATCH") {
    const body = await readJsonBody<{
      blockedReason?: string;
      horizonId?: string;
      ownerName?: string | null;
      ownerUserIds?: string[];
      state?: string;
      summary?: string;
      targetEndDate?: string | null;
      targetStartDate?: string | null;
      title?: string;
      type?: string;
    }>(request);
    const existing = repository.getWorkItem(workItemId);

    if (!existing) {
      sendError(response, 404, "Work item not found.");
      return true;
    }

    requireBoardAccess(repository, currentActor, existing.spaceId, "editor");

    sendJson(response, 200, updateWorkItemFromInput(repository, { ...body, id: workItemId }));

    return true;
  }

  if (request.method === "DELETE") {
    const existing = repository.getWorkItem(workItemId);

    if (!existing) {
      sendError(response, 404, "Work item not found.");
      return true;
    }

    requireBoardAccess(repository, currentActor, existing.spaceId, "editor");
    sendJson(response, 200, deleteWorkItem(repository, workItemId));
    return true;
  }

  return false;
}

async function handleSignalRoutesHttp(options: HandleRecordRoutesHttpOptions): Promise<boolean> {
  const { currentActor, pathname, repository, request, response } = options;

  if (request.method === "GET" && pathname === "/api/signals") {
    requireSignalAccess(repository, currentActor, "viewer");
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    sendJson(response, 200, buildSignalRecords(repository.getLedger(), accessPolicy));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/signals") {
    requireSignalAccess(repository, currentActor, "editor");
    const body = await readJsonBody<{
      expectedTimeline?: string;
      summary?: string;
      source?: string;
      title?: string;
      urgency?: string;
    }>(request);

    sendJson(response, 201, createSignalFromInput(repository, body));

    return true;
  }

  if (
    request.method === "POST" &&
    pathname.endsWith("/pull") &&
    pathname.startsWith("/api/signals/")
  ) {
    requireSignalAccess(repository, currentActor, "editor");
    const signalId = pathname.replace("/api/signals/", "").replace("/pull", "").replace(/\/$/, "");
    const body = await readJsonBody<{ targetSpaceId?: string }>(request);
    const targetSpaceId = String(body.targetSpaceId ?? "").trim();

    if (targetSpaceId) {
      requireBoardAccess(repository, currentActor, targetSpaceId, "editor");
    }

    sendJson(response, 201, pullSignalToSpaceFromInput(repository, { ...body, signalId }));

    return true;
  }

  if (!pathname.startsWith("/api/signals/")) {
    return false;
  }

  const signalId = pathname.replace("/api/signals/", "");

  if (request.method === "GET") {
    requireSignalAccess(repository, currentActor, "viewer");
    const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);
    const signal = findSignalRecord(repository.getLedger(), signalId, accessPolicy);

    if (!signal) {
      sendError(response, 404, "Signal not found.");
      return true;
    }

    sendJson(response, 200, signal);
    return true;
  }

  if (request.method === "PATCH") {
    requireSignalAccess(repository, currentActor, "editor");
    const body = await readJsonBody<{
      expectedTimeline?: string | null;
      source?: string;
      summary?: string;
      title?: string;
      urgency?: string;
    }>(request);

    sendJson(response, 200, updateSignalFromInput(repository, { ...body, id: signalId }));

    return true;
  }

  if (request.method === "DELETE") {
    requireSignalAccess(repository, currentActor, "editor");
    sendJson(response, 200, deleteSignal(repository, signalId));
    return true;
  }

  return false;
}
