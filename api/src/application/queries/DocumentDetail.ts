import type { AccessPolicy } from "../../domain/AccessPolicy.ts";
import type { DocumentDetailRepository } from "../ports/MikroLensRepository.ts";
import type { DocumentCollaborationSnapshot } from "../readModels/DocumentCollaborationSnapshot.ts";
import { buildDocumentSummaries, buildWorkItemRecords } from "./LedgerReadModels.ts";

export type DocumentDetail = DocumentCollaborationSnapshot & {
  id: string;
  horizonName: string | null;
  linkedWorkItems: ReturnType<typeof buildWorkItemRecords>;
  spaceId: string | null;
  spaceName: string | null;
};

export function buildDocumentDetail(
  repository: DocumentDetailRepository,
  documentId: string,
  accessPolicy: AccessPolicy | null = null,
): DocumentDetail | null {
  const document = repository.getDocument(documentId);

  if (!document) {
    return null;
  }

  const ledger = repository.getLedger();
  const summary = buildDocumentSummaries(ledger, {}, accessPolicy).find(
    (entry) => entry.id === document.id,
  );
  const linkedWorkItems = buildWorkItemRecords(ledger, {}, accessPolicy).filter((item) =>
    item.linkedDocuments.some((linkedDocument) => linkedDocument.id === document.id),
  );

  if (!summary) {
    return null;
  }

  return {
    createdAt: document.createdAt,
    horizonId: document.horizonId,
    horizonName: summary.horizonName,
    id: document.id,
    linkedWorkItems,
    markdown: document.markdown,
    spaceId: summary.spaceId,
    spaceName: summary.spaceName,
    summary: document.summary.trim() === "Fresh document draft." ? "" : document.summary,
    title: document.title,
    type: document.type,
    updatedAt: document.updatedAt,
  };
}
