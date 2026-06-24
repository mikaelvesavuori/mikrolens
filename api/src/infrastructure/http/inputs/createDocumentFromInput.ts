import type { DocumentCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createDocument } from "../../../application/usecases/documents/createDocument.ts";
import type { DocumentSummary } from "../../../domain/Document.ts";
import { isDocumentType } from "../../../domain/Document.ts";

export interface CreateDocumentFromInput {
  horizonId?: string | null;
  markdown?: string;
  spaceId?: string | null;
  summary?: string;
  title?: string;
  type?: string;
}

/**
 * @description Create a document from a loose command payload while preserving HTTP-facing validation messages.
 */
export function createDocumentFromInput(
  repository: DocumentCreationRepository,
  input: CreateDocumentFromInput,
): DocumentSummary {
  const spaceId = input.spaceId?.trim() || null;

  return createDocument(repository, {
    horizonId: input.horizonId,
    markdown: input.markdown,
    spaceId,
    summary: input.summary,
    title: input.title,
    type: input.type && isDocumentType(input.type) ? input.type : undefined,
  });
}
