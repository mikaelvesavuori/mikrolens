export function formatWorkItemForCopy(workItem: {
  horizon: { name: string };
  ref: string;
  state: string;
  summary?: string | null;
  title: string;
}): string;

export function buildViewUrl(uiState: Record<string, unknown>, currentUrl?: string): string;
export function buildDocumentUrl(
  documentId: string,
  uiState: Record<string, unknown>,
  currentUrl?: string,
): string;
export function buildWorkItemUrl(
  workItem: { id: string; ref?: string | null },
  uiState: Record<string, unknown>,
  currentUrl?: string,
): string;
