import type { ServerResponse } from "node:http";
import type { DocumentCollaborationSnapshot } from "../../application/readModels/DocumentCollaborationSnapshot.ts";

const PARTICIPANT_TTL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const collaboratorColors = ["#1665d8", "#1f8b57", "#b47111", "#c1485b", "#6b4fd3", "#0f8ca8"];

interface CollaborationParticipantInput {
  clientId: string;
  mode?: "editing" | "viewing";
  name?: string;
}

interface CollaborationDraftInput extends CollaborationParticipantInput {
  horizonId: string | null;
  markdown: string;
  summary: string;
  title: string;
  type: string;
}

interface CollaborationParticipantState {
  clientId: string;
  color: string;
  connectionCount: number;
  lastSeenAt: number;
  mode: "editing" | "viewing";
  name: string;
}

interface CollaborationDraftState {
  actorClientId: string;
  createdAt?: string;
  horizonId: string | null;
  markdown: string;
  summary: string;
  title: string;
  type: string;
  updatedAt: string;
}

export class DocumentCollaborationHub {
  readonly #draftsByDocumentId = new Map<string, CollaborationDraftState>();
  readonly #participantsByDocumentId = new Map<
    string,
    Map<string, CollaborationParticipantState>
  >();
  readonly #streamsByDocumentId = new Map<string, Set<ServerResponse>>();
  readonly #versionsByDocumentId = new Map<string, number>();

  connect(
    documentId: string,
    response: ServerResponse,
    detail: DocumentCollaborationSnapshot,
    participant: CollaborationParticipantInput,
  ): void {
    this.seedDraft(documentId, detail);
    this.registerStream(documentId, response);
    this.upsertParticipant(documentId, participant, { incrementConnection: true });

    response.writeHead(200, {
      ...response.getHeaders(),
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    });
    response.flushHeaders();
    response.write("retry: 1500\n\n");
    this.writeEvent(response, "sync", {
      draft: this.getDraft(documentId, detail),
      participants: this.listParticipants(documentId),
      version: this.getVersion(documentId),
    });
    this.broadcastPresence(documentId);

    const heartbeat = setInterval(() => {
      if (!response.writableEnded) {
        response.write(": keepalive\n\n");
      }
    }, HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeat);
      this.unregisterStream(documentId, response);
      this.releaseParticipantConnection(documentId, participant.clientId);
      this.broadcastPresence(documentId);
    });
  }

  updatePresence(documentId: string, participant: CollaborationParticipantInput): void {
    this.upsertParticipant(documentId, participant);
    this.broadcastPresence(documentId);
  }

  updateDraft(documentId: string, draft: CollaborationDraftInput): { version: number } {
    this.upsertParticipant(documentId, draft);
    const nextDraft: CollaborationDraftState = {
      actorClientId: draft.clientId,
      horizonId: draft.horizonId,
      markdown: draft.markdown,
      summary: draft.summary,
      title: draft.title,
      type: draft.type,
      updatedAt: new Date().toISOString(),
    };

    const existingDraft = this.#draftsByDocumentId.get(documentId);

    if (existingDraft?.createdAt) {
      nextDraft.createdAt = existingDraft.createdAt;
    }

    this.#draftsByDocumentId.set(documentId, nextDraft);

    const version = this.bumpVersion(documentId);
    this.broadcast(documentId, "draft", {
      draft: nextDraft,
      participants: this.listParticipants(documentId),
      version,
    });
    return {
      version,
    };
  }

  syncSavedDocument(
    documentId: string,
    detail: DocumentCollaborationSnapshot,
    actorClientId = "",
  ): { version: number } {
    this.seedDraft(documentId, detail, actorClientId, { force: true });
    const version = this.bumpVersion(documentId);

    this.broadcast(documentId, "saved", {
      draft: this.getDraft(documentId, detail),
      participants: this.listParticipants(documentId),
      version,
    });

    return {
      version,
    };
  }

  getDraft(documentId: string, detail: DocumentCollaborationSnapshot): CollaborationDraftState {
    this.seedDraft(documentId, detail);
    return this.#draftsByDocumentId.get(documentId) as CollaborationDraftState;
  }

  private seedDraft(
    documentId: string,
    detail: DocumentCollaborationSnapshot,
    actorClientId = "",
    options: { force?: boolean } = {},
  ): void {
    const currentDraft = this.#draftsByDocumentId.get(documentId);

    if (currentDraft && !options.force) {
      this.#versionsByDocumentId.set(documentId, this.getVersion(documentId));
      return;
    }

    const nextDraft: CollaborationDraftState = {
      actorClientId,
      createdAt: detail.createdAt,
      horizonId: detail.horizonId,
      markdown: detail.markdown,
      summary: detail.summary,
      title: detail.title,
      type: detail.type,
      updatedAt: detail.updatedAt,
    };

    if (
      !currentDraft ||
      currentDraft.updatedAt !== nextDraft.updatedAt ||
      currentDraft.title !== nextDraft.title ||
      currentDraft.summary !== nextDraft.summary ||
      currentDraft.markdown !== nextDraft.markdown ||
      currentDraft.type !== nextDraft.type ||
      currentDraft.horizonId !== nextDraft.horizonId
    ) {
      this.#draftsByDocumentId.set(documentId, nextDraft);
    }

    this.#versionsByDocumentId.set(documentId, this.getVersion(documentId));
  }

  private registerStream(documentId: string, response: ServerResponse): void {
    const streams = this.#streamsByDocumentId.get(documentId) ?? new Set<ServerResponse>();
    streams.add(response);
    this.#streamsByDocumentId.set(documentId, streams);
  }

  private unregisterStream(documentId: string, response: ServerResponse): void {
    const streams = this.#streamsByDocumentId.get(documentId);

    if (!streams) {
      return;
    }

    streams.delete(response);

    if (streams.size === 0) {
      this.#streamsByDocumentId.delete(documentId);
    }
  }

  private upsertParticipant(
    documentId: string,
    participant: CollaborationParticipantInput,
    options: { incrementConnection?: boolean } = {},
  ): void {
    if (!participant.clientId.trim()) {
      return;
    }

    const now = Date.now();
    const participants =
      this.#participantsByDocumentId.get(documentId) ??
      new Map<string, CollaborationParticipantState>();
    const existing = participants.get(participant.clientId);

    participants.set(participant.clientId, {
      clientId: participant.clientId,
      color: existing?.color ?? collaboratorColors[this.hashClientId(participant.clientId)],
      connectionCount: (existing?.connectionCount ?? 0) + (options.incrementConnection ? 1 : 0),
      lastSeenAt: now,
      mode: participant.mode ?? existing?.mode ?? "editing",
      name: normalizeParticipantName(participant.name, participant.clientId),
    });

    this.#participantsByDocumentId.set(documentId, participants);
    this.pruneParticipants(documentId, now);
  }

  private releaseParticipantConnection(documentId: string, clientId: string): void {
    const participants = this.#participantsByDocumentId.get(documentId);

    if (!participants) {
      return;
    }

    const participant = participants.get(clientId);

    if (!participant) {
      return;
    }

    participant.connectionCount = Math.max(0, participant.connectionCount - 1);
    participant.lastSeenAt = Date.now();
    this.pruneParticipants(documentId, Date.now(), true);
  }

  private pruneParticipants(documentId: string, now = Date.now(), allowDisconnected = false): void {
    const participants = this.#participantsByDocumentId.get(documentId);

    if (!participants) {
      return;
    }

    for (const [clientId, participant] of participants.entries()) {
      const isExpired = now - participant.lastSeenAt > PARTICIPANT_TTL_MS;
      const shouldRemove = participant.connectionCount === 0 && (allowDisconnected || isExpired);

      if (shouldRemove) {
        participants.delete(clientId);
      }
    }

    if (participants.size === 0) {
      this.#participantsByDocumentId.delete(documentId);
    }
  }

  private listParticipants(documentId: string) {
    this.pruneParticipants(documentId);
    return [...(this.#participantsByDocumentId.get(documentId)?.values() ?? [])]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((participant) => ({
        clientId: participant.clientId,
        color: participant.color,
        mode: participant.mode,
        name: participant.name,
      }));
  }

  private broadcastPresence(documentId: string): void {
    this.broadcast(documentId, "presence", {
      participants: this.listParticipants(documentId),
      version: this.getVersion(documentId),
    });
  }

  private broadcast(documentId: string, event: string, payload: unknown): void {
    const streams = this.#streamsByDocumentId.get(documentId);

    if (!streams) {
      return;
    }

    for (const response of streams) {
      if (response.destroyed || response.writableEnded) {
        streams.delete(response);
        continue;
      }

      this.writeEvent(response, event, payload);
    }

    if (streams.size === 0) {
      this.#streamsByDocumentId.delete(documentId);
    }
  }

  private writeEvent(response: ServerResponse, event: string, payload: unknown): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  private getVersion(documentId: string): number {
    return this.#versionsByDocumentId.get(documentId) ?? 1;
  }

  private bumpVersion(documentId: string): number {
    const version = this.getVersion(documentId) + 1;
    this.#versionsByDocumentId.set(documentId, version);
    return version;
  }

  private hashClientId(clientId: string): number {
    let hash = 0;

    for (let index = 0; index < clientId.length; index += 1) {
      hash = (hash << 5) - hash + clientId.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash) % collaboratorColors.length;
  }
}

function normalizeParticipantName(name: string | undefined, clientId: string): string {
  const trimmed = name?.trim();

  if (trimmed) {
    return trimmed.slice(0, 48);
  }

  return `Editor ${clientId.slice(0, 4).toUpperCase()}`;
}
