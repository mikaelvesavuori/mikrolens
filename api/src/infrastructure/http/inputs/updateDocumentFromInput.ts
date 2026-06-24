import type { DocumentUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateDocument } from "../../../application/usecases/documents/updateDocument.ts";
import type { DocumentSummary } from "../../../domain/Document.ts";
import { isDocumentType } from "../../../domain/Document.ts";

export interface UpdateDocumentFromInput {
  horizonId?: string | null;
  id: string;
  markdown?: string;
  summary?: string;
  title?: string;
  type?: string;
}

/**
 * @description Update a document from a loose command payload.
 */
export function updateDocumentFromInput(
  repository: DocumentUpdateRepository,
  input: UpdateDocumentFromInput,
): DocumentSummary {
  return updateDocument(repository, {
    horizonId: input.horizonId,
    id: input.id,
    markdown: input.markdown,
    summary: input.summary,
    title: input.title,
    type: input.type && isDocumentType(input.type) ? input.type : undefined,
  });
}
