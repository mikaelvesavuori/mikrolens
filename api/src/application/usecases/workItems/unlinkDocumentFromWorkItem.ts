import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { DocumentUnlinkingRepository } from "../../ports/MikroLensRepository.ts";
import { findWorkItemRecord } from "../../queries/LedgerReadModels.ts";

export interface UnlinkDocumentFromWorkItemInput {
  documentId: string;
  workItemId: string;
}

export function unlinkDocumentFromWorkItem(
  repository: DocumentUnlinkingRepository,
  input: UnlinkDocumentFromWorkItemInput,
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

  if (!existingLink) {
    throw new ValidationError("Document is not linked to this work item.");
  }

  const event: MikroLensDomainEvent = {
    action: "document.unlinked",
    entityId: workItem.id,
    entityType: "work-item",
    metadata: {
      documentId: document.id,
      documentTitle: document.title,
      ref: workItem.ref,
    },
    occurredAt: new Date().toISOString(),
    summary: `${workItem.ref} no longer references ${document.title}.`,
  };

  repository.transaction(() => {
    repository.deleteDocumentLink(workItem.id, document.id);
    emitMikroLensEvents(repository, [event]);
  });

  return findWorkItemRecord(repository.getLedger(), workItem.id);
}
