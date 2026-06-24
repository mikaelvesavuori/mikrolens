import { buildAppUrl } from "../routing/routes.js";

export function formatWorkItemForCopy(workItem) {
  const lines = [`${workItem.ref} · ${workItem.title}`];
  const summary = workItem.summary?.trim() ?? "";

  if (summary) {
    lines.push("", summary);
  }

  lines.push("", `State: ${workItem.state}`, `Horizon: ${workItem.horizon.name}`);
  return lines.join("\n");
}

export function buildViewUrl(uiState, currentUrl = getCurrentUrl()) {
  return buildAbsoluteUrl(
    buildAppUrl(
      {
        ...uiState,
        selectedDocumentId: "",
        selectedSignalId: "",
        selectedSignalRouteKey: "",
        selectedWorkItemId: "",
        selectedWorkItemRouteKey: "",
      },
      currentUrl,
    ),
    currentUrl,
  );
}

export function buildDocumentUrl(documentId, uiState, currentUrl = getCurrentUrl()) {
  return buildAbsoluteUrl(
    buildAppUrl(
      {
        ...getCanonicalShareState(uiState),
        activeArea: "Direct",
        selectedDocumentId: documentId,
      },
      currentUrl,
    ),
    currentUrl,
  );
}

export function buildWorkItemUrl(workItem, uiState, currentUrl = getCurrentUrl()) {
  return buildAbsoluteUrl(
    buildAppUrl(
      {
        ...getCanonicalShareState(uiState),
        activeArea: "Work",
        selectedWorkItemId: workItem.id,
        selectedWorkItemRouteKey: workItem.ref ?? workItem.id,
      },
      currentUrl,
    ),
    currentUrl,
  );
}

function getCanonicalShareState(uiState) {
  return {
    ...uiState,
    activeViewId: "",
    directSearch: "",
    directType: "",
    planDisplay: "",
    planTimelineSort: "",
    search: "",
    selectedDocumentId: "",
    selectedSignalId: "",
    selectedSignalRouteKey: "",
    selectedWorkItemId: "",
    selectedWorkItemRouteKey: "",
    workSort: "",
    workView: "",
  };
}

function buildAbsoluteUrl(pathname, currentUrl) {
  return new URL(pathname, currentUrl).href;
}

function getCurrentUrl() {
  if (typeof window !== "undefined" && window.location?.href) {
    return window.location.href;
  }

  return "http://localhost/";
}
