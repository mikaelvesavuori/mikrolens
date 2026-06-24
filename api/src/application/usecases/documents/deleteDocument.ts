import type { DocumentSummary } from "../../../domain/Document.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { DocumentDeletionRepository } from "../../ports/MikroLensRepository.ts";
import { buildDocumentSummaries } from "../../queries/LedgerReadModels.ts";

/**
 * @description Delete a document and remove any work links and activity for it.
 */
export function deleteDocument(
  repository: DocumentDeletionRepository,
  documentId: string,
): DocumentSummary {
  const deleted = buildDocumentSummaries(repository.getLedger()).find(
    (document) => document.id === documentId,
  );

  if (!deleted) {
    throw new NotFoundError("Document not found.");
  }

  repository.transaction(() => {
    repository.deleteDocumentLinksForDocument(documentId);
    repository.deleteActivityForEntity("document", documentId);
    repository.deleteDocument(documentId);
  });

  return deleted;
}
