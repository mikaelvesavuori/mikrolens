import type { DocumentDTO, DocumentSummary } from "../../../domain/Document.ts";
import { Document } from "../../../domain/Document.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { DocumentCreationRepository } from "../../ports/MikroLensRepository.ts";
import { findHorizon, findSpace } from "../../queries/LedgerLookups.ts";
import { buildDocumentSummaries } from "../../queries/LedgerReadModels.ts";

const DEFAULT_DOCUMENT_TITLE = "Untitled document";

export interface CreateDocumentInput {
  horizonId?: string | null;
  markdown?: string;
  spaceId?: string | null;
  summary?: string;
  title?: string;
  type?: DocumentDTO["type"];
}

/**
 * @description Create a new narrative document with calm defaults, ready for immediate editing.
 */
export function createDocument(
  repository: DocumentCreationRepository,
  input: CreateDocumentInput,
): DocumentSummary {
  const spaces = repository.listSpaces();
  const horizons = repository.listHorizons();
  const normalizedSpaceId = input.spaceId?.trim() || null;
  const space = normalizedSpaceId ? findSpace(spaces, normalizedSpaceId) : null;

  if (normalizedSpaceId && !space) {
    throw new ValidationError("Unknown space.");
  }

  if (input.horizonId && !normalizedSpaceId) {
    throw new ValidationError("Standalone documents cannot be assigned to a horizon.");
  }

  const horizon =
    input.horizonId === undefined || input.horizonId === null
      ? input.horizonId
      : findHorizon(horizons, input.horizonId);

  if (input.horizonId && (!space || !horizon || horizon.spaceId !== space.id)) {
    throw new ValidationError("Unknown horizon for the selected space.");
  }

  const now = new Date().toISOString();
  const title = input.title?.trim() || DEFAULT_DOCUMENT_TITLE;
  const document = Document.create({
    horizonId: input.horizonId === undefined ? null : (horizon?.id ?? null),
    id: generateId(),
    markdown: input.markdown?.trim() || `# ${title}\n\nStart writing here.`,
    now,
    spaceId: normalizedSpaceId,
    summary: input.summary?.trim() || "",
    title,
    type: input.type ?? "Note",
  }).toDTO();

  const event: MikroLensDomainEvent = {
    action: "document.created",
    entityId: document.id,
    entityType: "document",
    metadata: {
      title: document.title,
      type: document.type,
    },
    occurredAt: now,
    summary: space
      ? `${document.title} was created in ${space.name}.`
      : `${document.title} was created as a standalone document.`,
  };

  repository.transaction(() => {
    repository.saveDocument(document);
    emitMikroLensEvents(repository, [event]);
  });

  return buildDocumentSummaries(repository.getLedger()).find(
    (entry) => entry.id === document.id,
  ) as DocumentSummary;
}
