import type { DocumentDTO, DocumentSummary } from "../../../domain/Document.ts";
import { Document } from "../../../domain/Document.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { DocumentUpdateRepository } from "../../ports/MikroLensRepository.ts";
import { findHorizon } from "../../queries/LedgerLookups.ts";
import { buildDocumentSummaries } from "../../queries/LedgerReadModels.ts";

export interface UpdateDocumentInput {
  horizonId?: string | null;
  id: string;
  markdown?: string;
  summary?: string;
  title?: string;
  type?: DocumentDTO["type"];
}

/**
 * @description Apply a small editorial update to a narrative document.
 */
export function updateDocument(
  repository: DocumentUpdateRepository,
  input: UpdateDocumentInput,
): DocumentSummary {
  const existing = repository.getDocument(input.id);

  if (!existing) {
    throw new NotFoundError("Document not found.");
  }

  const horizon =
    input.horizonId === undefined || input.horizonId === null
      ? input.horizonId
      : findHorizon(repository.listHorizons(), input.horizonId);

  if (input.horizonId && !existing.spaceId) {
    throw new ValidationError("Standalone documents cannot be assigned to a horizon.");
  }

  if (input.horizonId && (!horizon || horizon.spaceId !== existing.spaceId)) {
    throw new ValidationError("Horizon does not belong to the document's space.");
  }

  const now = new Date().toISOString();
  const updated = Document.rehydrate(existing)
    .applyEditorialUpdate({
      horizonId: input.horizonId === undefined ? undefined : (horizon?.id ?? null),
      markdown: input.markdown,
      now,
      summary: input.summary,
      title: input.title,
      type: input.type,
    })
    .toDTO();

  const event: MikroLensDomainEvent = {
    action: "document.updated",
    entityId: updated.id,
    entityType: "document",
    metadata: {
      title: updated.title,
      type: updated.type,
    },
    occurredAt: now,
    summary: `${updated.title} was updated.`,
  };

  repository.transaction(() => {
    repository.saveDocument(updated);
    emitMikroLensEvents(repository, [event]);
  });

  return buildDocumentSummaries(repository.getLedger()).find(
    (document) => document.id === updated.id,
  ) as DocumentSummary;
}
