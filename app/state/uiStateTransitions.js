import {
  DEFAULT_DISPLAY_MODE,
  DEFAULT_PLAN_TIMELINE_SORT,
  DEFAULT_WORK_SORT,
  DEFAULT_WORK_VIEW,
  isGlobalArea,
  normalizeArea,
} from "./uiOptions.js";

const DEFAULT_CAPTURE_MODE = "work-item";

function dismissTransientUi(uiState) {
  uiState.confirmingModalClose = false;
  uiState.deleteConfirmation = null;
  uiState.mobileNavOpen = false;
}

function closeCapture(uiState) {
  uiState.captureModalOpen = false;
  uiState.captureMode = DEFAULT_CAPTURE_MODE;
}

function resetOverlayChrome(uiState) {
  dismissTransientUi(uiState);
  uiState.documentEditId = "";
  uiState.workItemDocsCollapsed = false;
  uiState.settingsModal = null;
}

export function setActiveArea(uiState, area) {
  const nextArea = normalizeArea(area);

  if (!nextArea) {
    return;
  }

  uiState.activeArea = nextArea;

  if (isGlobalArea(nextArea)) {
    uiState.activeSpaceId = "";
  }
}

export function clearDocumentSelection(uiState) {
  uiState.selectedDocumentId = "";
  uiState.documentEditId = "";
}

export function clearSignalSelection(uiState) {
  uiState.selectedSignalId = "";
  uiState.selectedSignalRouteKey = "";
}

export function clearWorkItemSelection(uiState) {
  uiState.selectedWorkItemId = "";
  uiState.selectedWorkItemRouteKey = "";
}

export function clearRecordSelection(uiState) {
  clearDocumentSelection(uiState);
  clearSignalSelection(uiState);
  clearWorkItemSelection(uiState);
}

export function openCaptureUi(uiState, mode) {
  dismissTransientUi(uiState);
  uiState.captureMode = mode;
  uiState.captureModalOpen = true;
  clearDocumentSelection(uiState);
  clearWorkItemSelection(uiState);
  uiState.settingsModal = null;
}

export function openSettingsUi(uiState, settingsModal, options = {}) {
  dismissTransientUi(uiState);
  closeCapture(uiState);
  clearDocumentSelection(uiState);
  clearWorkItemSelection(uiState);
  uiState.workItemDocsCollapsed = false;

  if (options.settingsSubview) {
    uiState.settingsSubview = options.settingsSubview;
  }

  uiState.settingsModal = settingsModal;
}

export function openWorkItemUi(uiState, selection) {
  resetOverlayChrome(uiState);
  clearSignalSelection(uiState);
  clearDocumentSelection(uiState);
  closeCapture(uiState);
  uiState.selectedWorkItemId = selection.id;
  uiState.selectedWorkItemRouteKey = selection.routeKey ?? selection.id;
}

export function openSignalUi(uiState, selection) {
  resetOverlayChrome(uiState);
  clearDocumentSelection(uiState);
  clearWorkItemSelection(uiState);
  closeCapture(uiState);
  uiState.selectedSignalId = selection.id;
  uiState.selectedSignalRouteKey = selection.routeKey ?? selection.id;
}

export function openDocumentUi(uiState, documentId) {
  resetOverlayChrome(uiState);
  clearSignalSelection(uiState);
  clearWorkItemSelection(uiState);
  closeCapture(uiState);
  uiState.selectedDocumentId = documentId;
}

export function closeModalUi(uiState) {
  uiState.confirmingModalClose = false;
  uiState.deleteConfirmation = null;
  closeCapture(uiState);
  clearRecordSelection(uiState);
  uiState.settingsModal = null;
}

export function applyExplicitRouteUi(uiState, route) {
  closeCapture(uiState);
  uiState.confirmingModalClose = false;
  uiState.deleteConfirmation = null;
  uiState.activeViewId = route.activeViewId ?? "";
  uiState.documentEditId = "";
  uiState.directSearch = route.directSearch ?? "";
  uiState.directType = route.directType ?? "";
  uiState.mobileNavOpen = false;
  uiState.planDisplay = route.planDisplay ?? DEFAULT_DISPLAY_MODE;
  uiState.planTimelineSort = route.planTimelineSort ?? DEFAULT_PLAN_TIMELINE_SORT;
  uiState.search = route.search ?? "";
  uiState.selectedDocumentId = route.selectedDocumentId;
  uiState.selectedSignalId = "";
  uiState.selectedSignalRouteKey = route.selectedSignalKey;
  uiState.selectedWorkItemId = "";
  uiState.selectedWorkItemRouteKey = route.selectedWorkItemKey;
  uiState.settingsModal = null;
  uiState.workSort = route.workSort ?? DEFAULT_WORK_SORT;
  uiState.workView = route.workView ?? DEFAULT_WORK_VIEW;
  uiState.workItemDocsCollapsed = false;
}

export function setActiveSpace(uiState, spaceId) {
  uiState.activeSpaceId = spaceId;
  clearDocumentSelection(uiState);
  clearWorkItemSelection(uiState);
}
