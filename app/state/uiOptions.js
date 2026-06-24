export const AREAS = ["Understand", "Direct", "Plan", "Work", "Intake", "Settings"];
export const DEFAULT_AREA = "Understand";
export const AREA_CONFIG = {
  Direct: {
    description: "Decisions and durable context",
    globalOnly: false,
    label: "Direct",
    path: "/direct",
  },
  Intake: {
    description: "Signals before commitment",
    globalOnly: true,
    label: "Intake",
    path: "/intake",
  },
  Plan: {
    description: "Now, Next, and Later",
    globalOnly: false,
    label: "Plan",
    path: "/plan",
  },
  Settings: {
    description: "Spaces, access, and automation",
    globalOnly: false,
    label: "Settings",
    path: "/settings",
  },
  Understand: {
    description: "System health, not surveillance",
    globalOnly: false,
    label: "Understand",
    path: "/understand",
  },
  Work: {
    description: "Small operational records",
    globalOnly: false,
    label: "Work",
    path: "/work",
  },
};
export const DISPLAY_MODES = ["board", "list", "timeline"];
export const DEFAULT_DISPLAY_MODE = "board";
export const PLAN_TIMELINE_SORTS = ["date", "space", "horizon"];
export const DEFAULT_PLAN_TIMELINE_SORT = "date";
export const SETTINGS_SUBVIEWS = ["spaces", "horizons", "users", "api-identities", "webhooks"];
export const DEFAULT_SETTINGS_SUBVIEW = "spaces";
export const THEMES = ["light", "dark"];
export const DEFAULT_THEME = "light";
export const WORK_VIEWS = ["board", "list-workflow", "list-evolution"];
export const DEFAULT_WORK_VIEW = "board";
export const WORK_SORTS = ["updated-desc", "id", "space", "state", "horizon", "title"];
export const DEFAULT_WORK_SORT = "updated-desc";

export function isArea(value) {
  return Boolean(normalizeArea(value));
}

export function normalizeArea(value) {
  return isSupportedOption(value, AREAS) ? value : null;
}

export function isGlobalArea(value) {
  const area = normalizeArea(value);

  return Boolean(area && AREA_CONFIG[area]?.globalOnly);
}

export function getAreaConfig(value) {
  const area = normalizeArea(value);

  return area ? AREA_CONFIG[area] : null;
}

export function isDisplayMode(value) {
  return isSupportedOption(value, DISPLAY_MODES);
}

export function isPlanTimelineSort(value) {
  return isSupportedOption(value, PLAN_TIMELINE_SORTS);
}

export function isSettingsSubview(value) {
  return isSupportedOption(value, SETTINGS_SUBVIEWS);
}

export function isTheme(value) {
  return isSupportedOption(value, THEMES);
}

export function isWorkView(value) {
  return isSupportedOption(value, WORK_VIEWS);
}

export function isWorkSort(value) {
  return isSupportedOption(value, WORK_SORTS);
}

function isSupportedOption(value, options) {
  return typeof value === "string" && options.includes(value);
}
