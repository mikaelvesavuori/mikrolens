export interface DocumentLinkOption {
  id?: string;
  horizonKey?: string | null;
  horizonName?: string | null;
  spaceName?: string | null;
  type?: string;
  title: string;
  [key: string]: unknown;
}

export function getDocumentLinkCandidates(options?: {
  allDocuments?: DocumentLinkOption[];
  linkedDocumentIds?: Iterable<string>;
  visibleDocuments?: DocumentLinkOption[];
}): DocumentLinkOption[];

export function formatDocumentLinkLabel(document: DocumentLinkOption): string;
export function sortLinkedDocuments(documents?: DocumentLinkOption[]): DocumentLinkOption[];
