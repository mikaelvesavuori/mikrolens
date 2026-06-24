export interface ParsedAppUrl {
  activeArea: string | null;
  activeSpaceId: string | null;
  activeViewId: string;
  directSearch: string;
  directType: string;
  hasExplicitPath: boolean;
  planDisplay: string | null;
  planTimelineSort: string | null;
  search: string;
  selectedDocumentId: string;
  selectedSignalKey: string;
  selectedWorkItemKey: string;
  settingsSubview: string | null;
  workSort: string | null;
  workView: string | null;
}

export interface ParseAppUrlOptions {
  defaultArea?: string | null;
}

export interface UiRouteState {
  activeArea: string;
  activeSpaceId: string;
  activeViewId?: string;
  directSearch?: string;
  directType?: string;
  planDisplay?: string;
  planTimelineSort?: string;
  search?: string;
  selectedDocumentId: string;
  selectedSignalId: string;
  selectedSignalRouteKey: string;
  selectedWorkItemId: string;
  selectedWorkItemRouteKey: string;
  settingsSubview: string;
  workSort?: string;
  workView?: string;
  snapshot?: {
    signals?: Array<{
      id: string;
      ref: string;
    }>;
    workItems?: Array<{
      id: string;
      ref: string;
    }>;
  } | null;
}

export function parseAppUrl(url: string, options?: ParseAppUrlOptions): ParsedAppUrl;
export function buildAppUrl(uiState: UiRouteState, currentUrl: string): string;
