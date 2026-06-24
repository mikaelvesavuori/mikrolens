import {
  AREA_CONFIG,
  DEFAULT_AREA,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_PLAN_TIMELINE_SORT,
  DEFAULT_SETTINGS_SUBVIEW,
  DEFAULT_WORK_SORT,
  DEFAULT_WORK_VIEW,
  isDisplayMode,
  isGlobalArea,
  isPlanTimelineSort,
  isSettingsSubview,
  isWorkSort,
  isWorkView,
  normalizeArea,
  SETTINGS_SUBVIEWS,
} from "../state/uiOptions.js";
import { getRouteSelectionKey } from "./routeSelection.js";

const AREA_TO_PATH = Object.fromEntries(
  Object.entries(AREA_CONFIG).map(([area, config]) => [area, config.path]),
);

const PATH_TO_AREA = new Map(
  Object.entries(AREA_TO_PATH).map(([area, path]) => [path.slice(1), area]),
);

export function parseAppUrl(url, options = {}) {
  const parsed = new URL(url, "http://localhost");
  const pathname = normalizePathname(parsed.pathname);
  const segments = pathname.split("/").filter(Boolean);
  const route = {
    activeArea: options.defaultArea ?? null,
    activeSpaceId: parsed.searchParams.get("spaceId"),
    activeViewId: parsed.searchParams.get("viewId") ?? "",
    directSearch: parsed.searchParams.get("directSearch") ?? "",
    directType: parsed.searchParams.get("directType") ?? "",
    hasExplicitPath: segments.length > 0,
    planDisplay: normalizeSupportedQueryValue(
      parsed.searchParams.get("planDisplay"),
      isDisplayMode,
    ),
    planTimelineSort: normalizeSupportedQueryValue(
      parsed.searchParams.get("planTimelineSort"),
      isPlanTimelineSort,
    ),
    search: parsed.searchParams.get("search") ?? "",
    selectedDocumentId: "",
    selectedSignalKey: "",
    selectedWorkItemKey: "",
    settingsSubview: null,
    workSort: normalizeSupportedQueryValue(parsed.searchParams.get("workSort"), isWorkSort),
    workView: normalizeSupportedQueryValue(parsed.searchParams.get("workView"), isWorkView),
  };

  if (segments.length === 0) {
    return route;
  }

  const [firstSegment, secondSegment] = segments;

  if (firstSegment === "documents" && secondSegment) {
    return {
      ...route,
      activeArea: "Direct",
      selectedDocumentId: decodeURIComponent(secondSegment),
    };
  }

  if (firstSegment === "work-items" && secondSegment) {
    return {
      ...route,
      activeArea: "Work",
      selectedWorkItemKey: decodeURIComponent(secondSegment),
    };
  }

  if (firstSegment === "signals" && secondSegment) {
    return {
      ...route,
      activeArea: "Intake",
      selectedSignalKey: decodeURIComponent(secondSegment),
    };
  }

  const activeArea = PATH_TO_AREA.get(firstSegment) ?? null;

  if (!activeArea) {
    return {
      ...route,
      activeArea: DEFAULT_AREA,
    };
  }

  return {
    ...route,
    activeArea: normalizeArea(activeArea),
    settingsSubview:
      activeArea === "Settings" && isSettingsSubview(secondSegment)
        ? secondSegment
        : activeArea === "Settings"
          ? DEFAULT_SETTINGS_SUBVIEW
          : null,
  };
}

export function buildAppUrl(uiState, currentUrl) {
  const parsed = new URL(currentUrl, "http://localhost");
  const url = new URL(parsed.pathname + parsed.search, parsed.origin);

  url.pathname = buildPathname(uiState);
  url.search = "";

  const activeArea = normalizeArea(uiState.activeArea) ?? DEFAULT_AREA;

  if (uiState.activeSpaceId && !isGlobalArea(activeArea)) {
    url.searchParams.set("spaceId", uiState.activeSpaceId);
  }

  appendOptionalQueryParam(url.searchParams, "viewId", uiState.activeViewId);

  if (activeArea === "Direct") {
    appendOptionalQueryParam(url.searchParams, "directSearch", uiState.directSearch);
    appendOptionalQueryParam(url.searchParams, "directType", uiState.directType);
  }

  if (activeArea === "Plan") {
    appendOptionalQueryParam(url.searchParams, "planDisplay", uiState.planDisplay, {
      defaultValue: DEFAULT_DISPLAY_MODE,
    });
    appendOptionalQueryParam(url.searchParams, "planTimelineSort", uiState.planTimelineSort, {
      defaultValue: DEFAULT_PLAN_TIMELINE_SORT,
    });
  }

  if (activeArea === "Work" || activeArea === "Intake") {
    appendOptionalQueryParam(url.searchParams, "search", uiState.search);
  }

  if (activeArea === "Work") {
    appendOptionalQueryParam(url.searchParams, "workSort", uiState.workSort, {
      defaultValue: DEFAULT_WORK_SORT,
    });
    appendOptionalQueryParam(url.searchParams, "workView", uiState.workView, {
      defaultValue: DEFAULT_WORK_VIEW,
    });
  }

  return `${url.pathname}${url.search}`;
}

function buildPathname(uiState) {
  const activeArea = normalizeArea(uiState.activeArea) ?? DEFAULT_AREA;

  if (uiState.selectedDocumentId) {
    return `/documents/${encodeURIComponent(uiState.selectedDocumentId)}`;
  }

  const signalPathSegment = getSignalPathSegment(uiState);

  if (signalPathSegment) {
    return `/signals/${encodeURIComponent(signalPathSegment)}`;
  }

  const workItemPathSegment = getWorkItemPathSegment(uiState);

  if (workItemPathSegment) {
    return `/work-items/${encodeURIComponent(workItemPathSegment)}`;
  }

  if (activeArea === "Settings") {
    return uiState.settingsSubview &&
      uiState.settingsSubview !== DEFAULT_SETTINGS_SUBVIEW &&
      SETTINGS_SUBVIEWS.includes(uiState.settingsSubview)
      ? `/settings/${uiState.settingsSubview}`
      : "/settings";
  }

  return AREA_TO_PATH[activeArea] ?? "/understand";
}

function getSignalPathSegment(uiState) {
  return getRouteSelectionKey(uiState.snapshot?.signals, {
    id: uiState.selectedSignalId,
    routeKey: uiState.selectedSignalRouteKey,
  });
}

function getWorkItemPathSegment(uiState) {
  return getRouteSelectionKey(uiState.snapshot?.workItems, {
    id: uiState.selectedWorkItemId,
    routeKey: uiState.selectedWorkItemRouteKey,
  });
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "");
}

function appendOptionalQueryParam(searchParams, key, value, options = {}) {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }

  const normalized = value.trim();

  if (options.defaultValue && normalized === options.defaultValue) {
    return;
  }

  searchParams.set(key, normalized);
}

function normalizeSupportedQueryValue(value, predicate) {
  if (typeof value !== "string") {
    return null;
  }

  return predicate(value) ? value : null;
}
