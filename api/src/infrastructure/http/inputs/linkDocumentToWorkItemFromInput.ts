import type { DocumentLinkingRepository } from "../../../application/ports/MikroLensRepository.ts";
import { linkDocumentToWorkItem } from "../../../application/usecases/workItems/linkDocumentToWorkItem.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface LinkDocumentToWorkItemFromInput {
  documentId?: string;
  workItemId: string;
}

export function linkDocumentToWorkItemFromInput(
  repository: DocumentLinkingRepository,
  input: LinkDocumentToWorkItemFromInput,
) {
  const documentId = input.documentId?.trim() ?? "";

  if (!documentId) {
    throw new ValidationError("documentId is required.");
  }

  return linkDocumentToWorkItem(repository, {
    documentId,
    workItemId: input.workItemId,
  });
}
