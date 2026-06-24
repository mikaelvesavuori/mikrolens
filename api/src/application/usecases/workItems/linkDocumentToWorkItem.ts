import type { DocumentLink } from "../../../domain/Document.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { DocumentLinkingRepository } from "../../ports/MikroLensRepository.ts";
import { findWorkItemRecord } from "../../queries/LedgerReadModels.ts";

export interface LinkDocumentToWorkItemInput {
  documentId: string;
  workItemId: string;
}

export function linkDocumentToWorkItem(
  repository: DocumentLinkingRepository,
  input: LinkDocumentToWorkItemInput,
) {
  const workItem = repository.getWorkItem(input.workItemId);

  if (!workItem) {
    throw new NotFoundError("Work item not found.");
  }

  const document = repository.getDocument(input.documentId);

  if (!document) {
    throw new NotFoundError("Document not found.");
  }

  const existingLink = repository
    .getLedger()
    .documentLinks.find(
      (link) => link.workItemId === input.workItemId && link.documentId === input.documentId,
    );

  if (existingLink) {
    throw new ValidationError("Document is already linked to this work item.");
  }

  const now = new Date().toISOString();
  const link: DocumentLink = {
    documentId: document.id,
    documentSection: "",
    id: generateId(),
    relation: "references",
    workItemId: workItem.id,
  };
  const event: MikroLensDomainEvent = {
    action: "document.linked",
    entityId: workItem.id,
    entityType: "work-item",
    metadata: {
      documentId: document.id,
      documentTitle: document.title,
      ref: workItem.ref,
    },
    occurredAt: now,
    summary: `${workItem.ref} now references ${document.title}.`,
  };

  repository.transaction(() => {
    repository.saveDocumentLink(link);
    emitMikroLensEvents(repository, [event]);
  });

  return findWorkItemRecord(repository.getLedger(), workItem.id);
}
