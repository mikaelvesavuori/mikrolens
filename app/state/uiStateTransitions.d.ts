export interface UiSelectionState {
  activeArea: string;
  activeSpaceId: string;
  activeViewId?: string;
  captureMode: string;
  captureModalOpen: boolean;
  confirmingModalClose: boolean;
  directSearch?: string;
  directType?: string;
  documentEditId: string;
  mobileNavOpen: boolean;
  planDisplay?: string;
  planTimelineSort?: string;
  search?: string;
  selectedDocumentId: string;
  selectedSignalId: string;
  selectedSignalRouteKey: string;
  selectedWorkItemId: string;
  selectedWorkItemRouteKey: string;
  settingsModal: Record<string, unknown> | null;
  settingsSubview: string;
  workSort?: string;
  workView?: string;
  workItemDocsCollapsed: boolean;
}

export interface UiRouteSelection {
  activeViewId?: string;
  directSearch?: string;
  directType?: string;
  planDisplay?: string | null;
  planTimelineSort?: string | null;
  search?: string;
  selectedDocumentId: string;
  selectedSignalKey: string;
  selectedWorkItemKey: string;
  workSort?: string | null;
  workView?: string | null;
}

export interface UiSelectionOptions {
  routeKey?: string;
}

export interface UiSettingsOptions {
  settingsSubview?: string;
}

export function setActiveArea(uiState: UiSelectionState, area: string): void;
export function clearDocumentSelection(uiState: UiSelectionState): void;
export function clearSignalSelection(uiState: UiSelectionState): void;
export function clearWorkItemSelection(uiState: UiSelectionState): void;
export function clearRecordSelection(uiState: UiSelectionState): void;
export function openCaptureUi(uiState: UiSelectionState, mode: string): void;
export function openSettingsUi(
  uiState: UiSelectionState,
  settingsModal: Record<string, unknown>,
  options?: UiSettingsOptions,
): void;
export function openWorkItemUi(
  uiState: UiSelectionState,
  selection: { id: string; routeKey?: string },
): void;
export function openSignalUi(
  uiState: UiSelectionState,
  selection: { id: string; routeKey?: string },
): void;
export function openDocumentUi(uiState: UiSelectionState, documentId: string): void;
export function closeModalUi(uiState: UiSelectionState): void;
export function applyExplicitRouteUi(uiState: UiSelectionState, route: UiRouteSelection): void;
export function setActiveSpace(uiState: UiSelectionState, spaceId: string): void;
