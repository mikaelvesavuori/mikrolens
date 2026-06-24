import type { DocumentUnlinkingRepository } from "../../../application/ports/MikroLensRepository.ts";
import { unlinkDocumentFromWorkItem } from "../../../application/usecases/workItems/unlinkDocumentFromWorkItem.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface UnlinkDocumentFromWorkItemFromInput {
  documentId?: string;
  workItemId: string;
}

export function unlinkDocumentFromWorkItemFromInput(
  repository: DocumentUnlinkingRepository,
  input: UnlinkDocumentFromWorkItemFromInput,
) {
  const documentId = input.documentId?.trim() ?? "";

  if (!documentId) {
    throw new ValidationError("documentId is required.");
  }

  return unlinkDocumentFromWorkItem(repository, {
    documentId,
    workItemId: input.workItemId,
  });
}
