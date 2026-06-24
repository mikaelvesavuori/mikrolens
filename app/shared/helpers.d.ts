export function normalizeSelection(): void;
export function applyViewFilters<T>(items: T[], filters: Record<string, unknown>): T[];
export function getActiveView(): Record<string, unknown> | null;
export function getActiveViewFromId(viewId: string): Record<string, unknown> | null;
export function canCurrentUserEditDocuments(): boolean;
export function canCurrentUserLinkDocuments(spaceId: string): boolean;
export function hasOpenModal(): boolean;
export function getVisibleDocuments(): Array<Record<string, unknown>>;
export function getDocumentSpaceLabels(
  document: {
    id: string;
    spaceName?: string | null;
  },
  workItems?: Array<{
    linkedDocuments?: Array<{ id: string }>;
    space?: {
      id?: string;
      name?: string;
    } | null;
    spaceId?: string | null;
    spaceName?: string | null;
  }>,
): string[];
export function getVisibleWorkItems(): Array<Record<string, unknown>>;
export function getVisibleSignals(): Array<Record<string, unknown>>;
export function getPrimaryEvolutionDocument(
  workItem: Record<string, unknown>,
): Record<string, unknown> | null;
export function getWorkItemsGroupedByEvolution(
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>>;
export function getSortedWorkItems<T>(items: T[]): T[];
export function getHorizonLabel(horizon: Record<string, unknown> | null | undefined): string;
export function getHorizonTimeframe(horizon: Record<string, unknown> | null | undefined): string;
export function getHorizonDefaultByKey(
  key: string,
  defaults?: Array<Record<string, unknown>>,
): Record<string, unknown> | null;
export function horizonDiffersFromDefault(
  horizon: Record<string, unknown> | null | undefined,
  defaults?: Array<Record<string, unknown>>,
): boolean;
export function getSortedSpaceHorizons(
  spaceId: string,
  horizons?: Array<Record<string, unknown>>,
): Array<Record<string, unknown>>;
export function formatHorizonKey(key: string): string;
export function escapeHtml(value: unknown): string;
export function readErrorMessage(response: Response, fallback: string): Promise<string>;
export function formatDateTime(value: string): string;
export function formatCalendarDate(value: string): string;
export function getIndefiniteArticle(value: string): string;
export function renderMarkdown(markdown: string): string;
