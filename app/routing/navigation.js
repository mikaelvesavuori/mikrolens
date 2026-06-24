import { persistUiState, state } from "../state/state.js";
import { isGlobalArea } from "../state/uiOptions.js";
import { applyExplicitRouteUi, setActiveArea } from "../state/uiStateTransitions.js";
import { hasRouteSelection, resolveRouteSelection } from "./routeSelection.js";
import { buildAppUrl, parseAppUrl } from "./routes.js";

export function applyLocationToState(options = {}) {
  const previous = snapshotNavigationState();
  const route = parseAppUrl(window.location.href, options);

  if (typeof route.activeArea === "string" && route.activeArea) {
    setActiveArea(state, route.activeArea);
  }

  if (typeof route.activeSpaceId === "string" && !isGlobalArea(state.activeArea)) {
    state.activeSpaceId = route.activeSpaceId;
  } else if (
    route.activeSpaceId === null &&
    (options.clearMissingSpaceId || route.hasExplicitPath)
  ) {
    state.activeSpaceId = "";
  }

  if (isGlobalArea(state.activeArea)) {
    state.activeSpaceId = "";
  }

  if (route.settingsSubview) {
    state.settingsSubview = route.settingsSubview;
  }

  if (route.hasExplicitPath) {
    applyExplicitRouteUi(state, route);
    syncRouteSelectionFromSnapshot();
  }

  persistUiState();

  return {
    areaChanged: previous.activeArea !== state.activeArea,
    documentChanged: previous.selectedDocumentId !== state.selectedDocumentId,
    settingsSubviewChanged: previous.settingsSubview !== state.settingsSubview,
    spaceChanged: previous.activeSpaceId !== state.activeSpaceId,
    workItemChanged:
      previous.selectedWorkItemId !== state.selectedWorkItemId ||
      previous.selectedWorkItemRouteKey !== state.selectedWorkItemRouteKey,
  };
}

export function pushCurrentUrl() {
  writeCurrentUrl("pushState");
}

export function replaceCurrentUrl() {
  writeCurrentUrl("replaceState");
}

export function syncRouteSelectionFromSnapshot() {
  if (!state.snapshot) {
    return;
  }

  if (
    !hasRouteSelection({
      id: state.selectedSignalId,
      routeKey: state.selectedSignalRouteKey,
    }) &&
    !hasRouteSelection({
      id: state.selectedWorkItemId,
      routeKey: state.selectedWorkItemRouteKey,
    })
  ) {
    return;
  }

  const signalSelection = resolveRouteSelection(state.snapshot.signals, {
    id: state.selectedSignalId,
    routeKey: state.selectedSignalRouteKey,
  });

  state.selectedSignalId = signalSelection.id;
  state.selectedSignalRouteKey = signalSelection.routeKey;

  const workItemSelection = resolveRouteSelection(state.snapshot.workItems, {
    id: state.selectedWorkItemId,
    routeKey: state.selectedWorkItemRouteKey,
  });

  state.selectedWorkItemId = workItemSelection.id;
  state.selectedWorkItemRouteKey = workItemSelection.routeKey;
}

function snapshotNavigationState() {
  return {
    activeArea: state.activeArea,
    activeSpaceId: state.activeSpaceId,
    selectedDocumentId: state.selectedDocumentId,
    selectedSignalId: state.selectedSignalId,
    selectedSignalRouteKey: state.selectedSignalRouteKey,
    selectedWorkItemId: state.selectedWorkItemId,
    selectedWorkItemRouteKey: state.selectedWorkItemRouteKey,
    settingsSubview: state.settingsSubview,
  };
}

function writeCurrentUrl(method) {
  persistUiState();
  const nextUrl = buildAppUrl(state, window.location.href);
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (nextUrl === currentUrl) {
    return;
  }

  window.history[method]({}, document.title, nextUrl);
}
