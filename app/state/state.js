import {
  DEFAULT_AREA,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_PLAN_TIMELINE_SORT,
  DEFAULT_SETTINGS_SUBVIEW,
  DEFAULT_THEME,
  DEFAULT_WORK_SORT,
  DEFAULT_WORK_VIEW,
  isDisplayMode,
  isPlanTimelineSort,
  isSettingsSubview,
  isTheme,
  isWorkSort,
  isWorkView,
  normalizeArea,
} from "./uiOptions.js";

export { AREAS } from "./uiOptions.js";
export const STORAGE_KEY = "mikrolens-ui-state";

function getSystemTheme() {
  if (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return DEFAULT_THEME;
}

export const state = {
  activeArea: DEFAULT_AREA,
  activeSpaceId: "",
  activeViewId: "",
  allDocuments: [],
  auth: {
    currentUserEmail: "",
    currentUserId: "",
    currentUserRole: "",
    demoUsers: [],
    errorMessage: "",
    isAuthenticated: false,
    oauthProviders: [],
    pending: false,
    pendingDemoUserId: "",
    pendingEmail: "",
    permissions: [],
    requiresAuthentication: false,
    screen: "form",
  },
  capabilities: {
    canDeleteDocuments: false,
    canDeleteSignals: false,
    canDeleteWorkItems: false,
    canEditDocuments: false,
  },
  captureMode: "work-item",
  confirmingModalClose: false,
  config: null,
  captureModalOpen: false,
  deleteConfirmation: null,
  directSearch: "",
  directType: "",
  documentDetailsById: new Map(),
  documentDetailStatusById: new Map(),
  documentEditor: null,
  documentEditId: "",
  dragPayload: null,
  error: "",
  loading: false,
  mobileNavOpen: false,
  notifications: [],
  planDisplay: DEFAULT_DISPLAY_MODE,
  planTimelineSort: DEFAULT_PLAN_TIMELINE_SORT,
  search: "",
  selectedDocumentId: "",
  selectedSignalId: "",
  selectedSignalRouteKey: "",
  selectedWorkItemId: "",
  selectedWorkItemRouteKey: "",
  settingsModal: null,
  settingsSubview: DEFAULT_SETTINGS_SUBVIEW,
  snapshot: null,
  spaceOptions: [],
  theme: getSystemTheme(),
  workView: DEFAULT_WORK_VIEW,
  workItemDocsCollapsed: false,
  workSort: DEFAULT_WORK_SORT,
};

export const elements = {
  appShell: document.getElementById("app-shell"),
  authRoot: document.getElementById("auth-root"),
  mainPanel: document.getElementById("main-panel"),
  mobileNavToggle: document.getElementById("mobile-nav-toggle"),
  modalRoot: document.getElementById("modal-root"),
  primaryNav: document.getElementById("primary-nav"),
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  sidebarBrand: document.getElementById("sidebar-brand"),
  sidebarFooter: document.getElementById("sidebar-footer"),
  toastRoot: document.getElementById("toast-root"),
  topbar: document.getElementById("topbar"),
};

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

export function persistUiState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeArea: state.activeArea,
      activeSpaceId: state.activeSpaceId,
      activeViewId: state.activeViewId,
      planDisplay: state.planDisplay,
      planTimelineSort: state.planTimelineSort,
      settingsSubview: state.settingsSubview,
      theme: state.theme,
      workView: state.workView,
      workSort: state.workSort,
    }),
  );
}

export function restoreUiState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");

    const savedArea = normalizeArea(saved.activeArea);

    if (savedArea) {
      state.activeArea = savedArea;
    }

    if (typeof saved.activeSpaceId === "string") {
      state.activeSpaceId = saved.activeSpaceId;
    }

    if (typeof saved.activeViewId === "string") {
      state.activeViewId = saved.activeViewId;
    }

    if (isSettingsSubview(saved.settingsSubview)) {
      state.settingsSubview = saved.settingsSubview;
    }

    if (isWorkView(saved.workView)) {
      state.workView = saved.workView;
    }

    if (isWorkSort(saved.workSort)) {
      state.workSort = saved.workSort;
    }

    if (isDisplayMode(saved.planDisplay)) {
      state.planDisplay = saved.planDisplay;
    }

    if (isPlanTimelineSort(saved.planTimelineSort)) {
      state.planTimelineSort = saved.planTimelineSort;
    }

    if (isTheme(saved.theme)) {
      state.theme = saved.theme;
    }
  } catch {
    // Ignore malformed local UI state.
  }

  applyTheme();
}
