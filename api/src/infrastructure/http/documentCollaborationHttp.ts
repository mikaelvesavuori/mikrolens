import type { IncomingMessage, ServerResponse } from "node:http";
import type { DocumentDetailRepository } from "../../application/ports/MikroLensRepository.ts";
import { buildDocumentDetail } from "../../application/queries/DocumentDetail.ts";
import type { DocumentCollaborationHub } from "../collaboration/DocumentCollaborationHub.ts";
import { readJsonBody, sendError, sendJson, sendNoContent } from "./httpUtils.ts";

export interface HandleDocumentCollaborationHttpOptions {
  baseUrl: string;
  collaborationHub: DocumentCollaborationHub;
  documentPath: string;
  repository: DocumentDetailRepository;
  request: IncomingMessage;
  response: ServerResponse;
}

/**
 * @description Handle live document collaboration transport concerns outside the main server router.
 */
export async function handleDocumentCollaborationHttp(
  options: HandleDocumentCollaborationHttpOptions,
): Promise<boolean> {
  const { baseUrl, collaborationHub, documentPath, repository, request, response } = options;
  const slashIndex = documentPath.indexOf("/");
  const documentId = slashIndex === -1 ? documentPath : documentPath.slice(0, slashIndex);
  const tail = slashIndex === -1 ? "" : documentPath.slice(slashIndex + 1);

  if (!documentId || !tail?.startsWith("collaboration")) {
    return false;
  }

  const detail = buildDocumentDetail(repository, documentId);

  if (!detail) {
    sendError(response, 404, "Document not found.");
    return true;
  }

  if (request.method === "GET" && tail === "collaboration/stream") {
    const requestUrl = new URL(request.url ?? "", baseUrl);

    collaborationHub.connect(documentId, response, detail, {
      clientId: requestUrl.searchParams.get("clientId")?.trim() ?? "",
      mode: requestUrl.searchParams.get("mode") === "viewing" ? "viewing" : "editing",
      name: requestUrl.searchParams.get("name")?.trim() ?? undefined,
    });
    return true;
  }

  if (request.method === "POST" && tail === "collaboration/presence") {
    const body = await readJsonBody<{
      clientId?: string;
      mode?: "editing" | "viewing";
      name?: string;
    }>(request);

    collaborationHub.updatePresence(documentId, {
      clientId: body.clientId?.trim() ?? "",
      mode: body.mode === "viewing" ? "viewing" : "editing",
      name: body.name?.trim() ?? undefined,
    });
    sendNoContent(response);
    return true;
  }

  if (request.method === "POST" && tail === "collaboration/draft") {
    const body = await readJsonBody<{
      clientId?: string;
      horizonId?: string | null;
      markdown?: string;
      mode?: "editing" | "viewing";
      name?: string;
      summary?: string;
      title?: string;
      type?: string;
    }>(request);

    const result = collaborationHub.updateDraft(documentId, {
      clientId: body.clientId?.trim() ?? "",
      horizonId:
        body.horizonId === undefined
          ? (detail.horizonId ?? null)
          : (body.horizonId?.trim() ?? "") || null,
      markdown: body.markdown ?? detail.markdown,
      mode: body.mode === "viewing" ? "viewing" : "editing",
      name: body.name?.trim() ?? undefined,
      summary: body.summary ?? detail.summary,
      title: body.title ?? detail.title,
      type: body.type ?? detail.type,
    });

    sendJson(response, 202, result);
    return true;
  }

  return false;
}
