import {
  applyExplicitRouteUi,
  clearRecordSelection,
  closeModalUi,
  openCaptureUi,
  openDocumentUi,
  openSettingsUi,
  openSignalUi,
  openWorkItemUi,
  setActiveArea,
  setActiveSpace,
} from "../../../app/state/uiStateTransitions.js";

function createUiState(): import("../../../app/state/uiStateTransitions.js").UiSelectionState {
  return {
    activeArea: "Understand",
    activeSpaceId: "space_platform",
    captureMode: "work-item",
    captureModalOpen: false,
    confirmingModalClose: false,
    documentEditId: "doc_editing",
    mobileNavOpen: true,
    selectedDocumentId: "doc_1",
    selectedSignalId: "sug_1",
    selectedSignalRouteKey: "SIG-1",
    selectedWorkItemId: "work_1",
    selectedWorkItemRouteKey: "ML-1",
    settingsModal: { kind: "space-edit", spaceId: "space_platform" },
    settingsSubview: "spaces",
    workItemDocsCollapsed: false,
  };
}

describe("ui state transitions", () => {
  it("opens capture without carrying document or work item state", () => {
    const uiState = createUiState();

    openCaptureUi(uiState, "signal");

    expect(uiState.captureModalOpen).toBe(true);
    expect(uiState.captureMode).toBe("signal");
    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.selectedWorkItemRouteKey).toBe("");
    expect(uiState.settingsModal).toBeNull();
    expect(uiState.selectedSignalId).toBe("sug_1");
  });

  it("opens settings dialogs with the expected subview and resets overlays", () => {
    const uiState = createUiState();

    openSettingsUi(uiState, { kind: "api-identity-create" }, { settingsSubview: "api-identities" });

    expect(uiState.captureModalOpen).toBe(false);
    expect(uiState.captureMode).toBe("work-item");
    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.settingsSubview).toBe("api-identities");
    expect(uiState.settingsModal).toEqual({ kind: "api-identity-create" });
    expect(uiState.workItemDocsCollapsed).toBe(false);
  });

  it("opens work items, signals, and documents through shared transitions", () => {
    const uiState = createUiState();

    openWorkItemUi(uiState, { id: "work_2", routeKey: "ML-2" });

    expect(uiState.selectedSignalId).toBe("");
    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("work_2");
    expect(uiState.selectedWorkItemRouteKey).toBe("ML-2");

    openSignalUi(uiState, { id: "sug_2", routeKey: "SIG-2" });

    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.selectedSignalId).toBe("sug_2");
    expect(uiState.selectedSignalRouteKey).toBe("SIG-2");

    openDocumentUi(uiState, "doc_2");

    expect(uiState.selectedSignalId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.selectedDocumentId).toBe("doc_2");
  });

  it("applies explicit route state and closes transient UI", () => {
    const uiState = createUiState();

    applyExplicitRouteUi(uiState, {
      selectedDocumentId: "",
      selectedSignalKey: "SIG-9",
      selectedWorkItemKey: "",
    });

    expect(uiState.captureModalOpen).toBe(false);
    expect(uiState.confirmingModalClose).toBe(false);
    expect(uiState.mobileNavOpen).toBe(false);
    expect(uiState.documentEditId).toBe("");
    expect(uiState.selectedSignalRouteKey).toBe("SIG-9");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.settingsModal).toBeNull();
  });

  it("clears records and closes modals predictably", () => {
    const uiState = createUiState();

    clearRecordSelection(uiState);

    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedSignalId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.documentEditId).toBe("");

    uiState.captureModalOpen = true;
    uiState.settingsModal = { kind: "user-delete", userId: "user_1" };

    closeModalUi(uiState);

    expect(uiState.captureModalOpen).toBe(false);
    expect(uiState.captureMode).toBe("work-item");
    expect(uiState.settingsModal).toBeNull();
    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedSignalId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
  });

  it("keeps area and space helpers small and explicit", () => {
    const uiState = createUiState();

    setActiveArea(uiState, "Intake");
    expect(uiState.activeArea).toBe("Intake");
    expect(uiState.activeSpaceId).toBe("");

    uiState.activeArea = "Work";
    setActiveArea(uiState, "Unknown");
    expect(uiState.activeArea).toBe("Work");

    uiState.selectedDocumentId = "doc_5";
    uiState.selectedWorkItemId = "work_5";
    uiState.selectedWorkItemRouteKey = "ML-5";
    uiState.documentEditId = "doc_5";

    setActiveSpace(uiState, "space_product");

    expect(uiState.activeSpaceId).toBe("space_product");
    expect(uiState.selectedDocumentId).toBe("");
    expect(uiState.selectedWorkItemId).toBe("");
    expect(uiState.selectedWorkItemRouteKey).toBe("");
    expect(uiState.documentEditId).toBe("");
  });
});
