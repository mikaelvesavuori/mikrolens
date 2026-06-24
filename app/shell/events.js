import {
  beginOAuthSignIn,
  showAuthForm,
  signOut,
  submitAuthEmail,
  submitDemoSignIn,
} from "../auth/auth.js";
import {
  applyMarkdownShortcut,
  copyDocumentEditorContent,
  downloadDocumentEditorMarkdown,
  handleDocumentEditorKeydown,
  setDocumentEditorView,
  startDocumentEditing,
  stopDocumentEditing,
  toggleDocumentEditorInspector,
  updateDocumentEditorField,
} from "../documents/documentEditor.js";
import { pushCurrentUrl, replaceCurrentUrl } from "../routing/navigation.js";
import { copyTextToClipboard } from "../shared/clipboard.js";
import { canCurrentUserEditDocuments, hasOpenModal } from "../shared/helpers.js";
import {
  buildDocumentUrl,
  buildViewUrl,
  buildWorkItemUrl,
  formatWorkItemForCopy,
} from "../shared/share.js";
import { persistUiState, state } from "../state/state.js";
import {
  isDisplayMode,
  isGlobalArea,
  isPlanTimelineSort,
  isSettingsSubview,
  isWorkSort,
  isWorkView,
} from "../state/uiOptions.js";
import {
  openCaptureUi,
  openSettingsUi,
  setActiveArea,
  setActiveSpace,
} from "../state/uiStateTransitions.js";
import { dismissNotification, showError, showSuccess } from "../ui/notifications.js";
import { render, renderMainPanel } from "../ui/render.js";
import {
  closeModal,
  createDocumentRecord,
  deleteDocumentRecord,
  deleteSignalRecord,
  deleteUserRecord,
  deleteWebhookEndpoint,
  deleteWorkItemRecord,
  ensureDocumentDetail,
  moveRecordToHorizon,
  moveWorkItemToState,
  openDocument,
  openSignal,
  openWorkItem,
  refreshSnapshot,
  requestModalClose,
  rotateApiIdentityToken,
  submitApiIdentityCreate,
  submitApiIdentityUpdate,
  submitDocumentUpdate,
  submitHorizonDefaultUpdate,
  submitHorizonUpdate,
  submitQuickCapture,
  submitSignal,
  submitSignalPull,
  submitSignalUpdate,
  submitSpaceCreate,
  submitSpaceUpdate,
  submitUserCreate,
  submitUserUpdate,
  submitWebhookCreate,
  submitWebhookUpdate,
  submitWorkItemDocumentLink,
  submitWorkItemUpdate,
  syncWorkItemDocsDrawer,
  unlinkWorkItemDocument,
} from "./actions.js";

let currentDropZone = null;

export function bindEvents() {
  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.classList.contains("modal-backdrop")) {
      event.preventDefault();
      event.stopPropagation();
      requestModalClose();
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.classList.contains("sidebar-backdrop")
    ) {
      state.mobileNavOpen = false;
      render();
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const target = event.target.closest(
      "[data-area], [data-select-document], [data-select-signal], [data-select-work-item], [data-action], [data-document-view], [data-markdown-shortcut], [data-plan-display], [data-plan-timeline-sort], [data-settings-subview], [data-work-view]",
    );

    if (!target) {
      return;
    }

    const area = target.getAttribute("data-area");

    if (area) {
      const previousSpaceId = state.activeSpaceId;
      setActiveArea(state, area);
      state.mobileNavOpen = false;
      pushCurrentUrl();
      if (isGlobalArea(area) && previousSpaceId) {
        void refreshSnapshot();
      } else {
        render();
      }
      return;
    }

    const workItemId = target.getAttribute("data-select-work-item");

    if (workItemId) {
      openWorkItem(workItemId);
      return;
    }

    const signalId = target.getAttribute("data-select-signal");

    if (signalId) {
      openSignal(signalId);
      return;
    }

    const documentId = target.getAttribute("data-select-document");

    if (documentId) {
      openDocument(documentId);
      return;
    }

    const action = target.getAttribute("data-action");

    const planTimelineSort = target.getAttribute("data-plan-timeline-sort");

    if (planTimelineSort) {
      if (!isPlanTimelineSort(planTimelineSort)) {
        return;
      }

      state.planTimelineSort = planTimelineSort;
      replaceCurrentUrl();
      persistUiState();
      renderMainPanel();
      return;
    }

    switch (action) {
      case "show-auth-form":
        showAuthForm();
        return;
      case "sign-out":
        signOut();
        return;
      case "start-oauth-sign-in": {
        const providerId = target.getAttribute("data-provider-id") ?? "";

        beginOAuthSignIn(providerId);
        return;
      }
      case "sign-in-demo-user": {
        const userId = target.getAttribute("data-demo-user-id") ?? "";

        void submitDemoSignIn(userId);
        return;
      }
      case "cancel-document-edit":
        stopDocumentEditing();
        state.documentEditId = "";
        render();
        return;
      case "cancel-delete-record":
        state.deleteConfirmation = null;
        render();
        return;
      case "dismiss-notification": {
        const notificationId = target.getAttribute("data-notification-id") ?? "";

        if (!notificationId) {
          return;
        }

        dismissNotification(notificationId);
        return;
      }
      case "clear-view":
        state.activeViewId = "";
        replaceCurrentUrl();
        persistUiState();
        render();
        return;
      case "close-modal":
      case "clear-selection":
        requestModalClose();
        return;
      case "cancel-close-modal":
        state.confirmingModalClose = false;
        render();
        return;
      case "confirm-close-modal":
        closeModal();
        return;
      case "open-work-item-delete":
        if (state.selectedWorkItemId) {
          state.deleteConfirmation = {
            id: state.selectedWorkItemId,
            kind: "work-item",
          };
          render();
        }
        return;
      case "unlink-work-item-document": {
        const workItemId = target.getAttribute("data-work-item-id") ?? "";
        const documentId = target.getAttribute("data-document-id") ?? "";
        void unlinkWorkItemDocument(workItemId, documentId);
        return;
      }
      case "open-signal-delete":
        if (state.selectedSignalId) {
          state.deleteConfirmation = {
            id: state.selectedSignalId,
            kind: "signal",
          };
          render();
        }
        return;
      case "open-document-delete":
        if (state.selectedDocumentId) {
          state.deleteConfirmation = {
            id: state.selectedDocumentId,
            kind: "document",
          };
          render();
        }
        return;
      case "confirm-work-item-delete":
        if (state.deleteConfirmation?.kind === "work-item") {
          void deleteWorkItemRecord(state.deleteConfirmation.id);
        }
        return;
      case "confirm-signal-delete":
        if (state.deleteConfirmation?.kind === "signal") {
          void deleteSignalRecord(state.deleteConfirmation.id);
        }
        return;
      case "confirm-document-delete":
        if (state.deleteConfirmation?.kind === "document") {
          void deleteDocumentRecord(state.deleteConfirmation.id);
        }
        return;
      case "open-capture":
        stopDocumentEditing();
        openCaptureUi(state, "work-item");
        pushCurrentUrl();
        render();
        return;
      case "create-document":
        void createDocumentRecord();
        return;
      case "open-suggest":
        stopDocumentEditing();
        openCaptureUi(state, "signal");
        pushCurrentUrl();
        render();
        return;
      case "open-space-create":
        stopDocumentEditing();
        openSettingsUi(state, { kind: "space-create" });
        pushCurrentUrl();
        render();
        return;
      case "open-api-identity-create":
        stopDocumentEditing();
        openSettingsUi(
          state,
          { kind: "api-identity-create" },
          { settingsSubview: "api-identities" },
        );
        pushCurrentUrl();
        render();
        return;
      case "open-user-create":
        stopDocumentEditing();
        openSettingsUi(state, { kind: "user-create" }, { settingsSubview: "users" });
        pushCurrentUrl();
        render();
        return;
      case "open-webhook-create":
        stopDocumentEditing();
        openSettingsUi(state, { kind: "webhook-create" }, { settingsSubview: "webhooks" });
        pushCurrentUrl();
        render();
        return;
      case "open-user-delete": {
        stopDocumentEditing();
        const userId = target.getAttribute("data-user-id") ?? "";

        if (!userId) {
          return;
        }

        openSettingsUi(state, { kind: "user-delete", userId }, { settingsSubview: "users" });
        pushCurrentUrl();
        render();
        return;
      }
      case "open-user-edit": {
        stopDocumentEditing();
        const userId = target.getAttribute("data-user-id") ?? "";

        if (!userId) {
          return;
        }

        openSettingsUi(state, { kind: "user-edit", userId }, { settingsSubview: "users" });
        pushCurrentUrl();
        render();
        return;
      }
      case "open-webhook-edit": {
        stopDocumentEditing();
        const webhookId = target.getAttribute("data-webhook-id") ?? "";

        if (!webhookId) {
          return;
        }

        openSettingsUi(state, { kind: "webhook-edit", webhookId }, { settingsSubview: "webhooks" });
        pushCurrentUrl();
        render();
        return;
      }
      case "open-webhook-delete": {
        const webhookId = target.getAttribute("data-webhook-id") ?? "";

        if (!webhookId) {
          return;
        }

        openSettingsUi(
          state,
          { kind: "webhook-delete", webhookId },
          { settingsSubview: "webhooks" },
        );
        pushCurrentUrl();
        render();
        return;
      }
      case "confirm-webhook-delete": {
        const webhookId = target.getAttribute("data-webhook-id") ?? "";

        if (!webhookId) {
          return;
        }

        void deleteWebhookEndpoint(webhookId);
        return;
      }
      case "confirm-user-delete": {
        const userId = target.getAttribute("data-user-id") ?? "";

        if (!userId) {
          return;
        }

        void deleteUserRecord(userId);
        return;
      }
      case "open-api-identity-edit": {
        const apiIdentityId = target.getAttribute("data-api-identity-id") ?? "";

        if (!apiIdentityId) {
          return;
        }

        openSettingsUi(
          state,
          { kind: "api-identity-edit", apiIdentityId },
          { settingsSubview: "api-identities" },
        );
        pushCurrentUrl();
        render();
        return;
      }
      case "rotate-api-identity-token": {
        const apiIdentityId = target.getAttribute("data-api-identity-id") ?? "";

        if (!apiIdentityId) {
          return;
        }

        void rotateApiIdentityToken(apiIdentityId);
        return;
      }
      case "open-space-edit": {
        stopDocumentEditing();
        const spaceId = target.getAttribute("data-space-id") ?? "";

        if (!spaceId) {
          return;
        }

        openSettingsUi(state, { kind: "space-edit", spaceId });
        pushCurrentUrl();
        render();
        return;
      }
      case "open-space-horizons-edit": {
        stopDocumentEditing();
        const spaceId = target.getAttribute("data-space-id") ?? "";

        if (!spaceId) {
          return;
        }

        openSettingsUi(
          state,
          { kind: "space-horizons-edit", spaceId },
          { settingsSubview: "horizons" },
        );
        pushCurrentUrl();
        render();
        return;
      }
      case "open-org-horizons-edit":
        stopDocumentEditing();
        openSettingsUi(state, { kind: "org-horizons-edit" }, { settingsSubview: "horizons" });
        pushCurrentUrl();
        render();
        return;
      case "open-horizon-default-edit": {
        stopDocumentEditing();
        const horizonDefaultKey = target.getAttribute("data-horizon-default-key") ?? "";

        if (!horizonDefaultKey) {
          return;
        }

        openSettingsUi(
          state,
          { kind: "horizon-default-edit", horizonDefaultKey },
          { settingsSubview: "horizons" },
        );
        pushCurrentUrl();
        render();
        return;
      }
      case "open-horizon-edit": {
        stopDocumentEditing();
        const horizonId = target.getAttribute("data-horizon-id") ?? "";

        if (!horizonId) {
          return;
        }

        openSettingsUi(state, { kind: "horizon-edit", horizonId }, { settingsSubview: "horizons" });
        pushCurrentUrl();
        render();
        return;
      }
      case "toggle-mobile-nav":
        state.mobileNavOpen = !state.mobileNavOpen;
        render();
        return;
      case "toggle-theme":
        state.theme = state.theme === "dark" ? "light" : "dark";
        persistUiState();
        render();
        return;
      case "start-document-edit":
        if (
          state.selectedDocumentId &&
          state.capabilities.canEditDocuments &&
          canCurrentUserEditDocuments()
        ) {
          const detail = state.documentDetailsById.get(state.selectedDocumentId);

          if (detail) {
            startDocumentEditing(detail);
          }

          render();
        }
        return;
      case "copy-document-content":
        void copyDocumentEditorContent();
        return;
      case "copy-document-link":
        void copySelectedDocumentLink();
        return;
      case "copy-view-link":
        void copyCurrentViewLink();
        return;
      case "copy-work-item-content":
        void copySelectedWorkItemContent();
        return;
      case "copy-work-item-link":
        void copySelectedWorkItemLink();
        return;
      case "download-document-markdown":
        downloadDocumentEditorMarkdown();
        return;
      case "toggle-document-editor-inspector":
        toggleDocumentEditorInspector();
        render();
        return;
      case "retry-document-load":
        if (state.selectedDocumentId) {
          void ensureDocumentDetail(state.selectedDocumentId, { force: true });
        }
        return;
      case "toggle-work-item-docs":
        state.workItemDocsCollapsed = !state.workItemDocsCollapsed;
        if (!syncWorkItemDocsDrawer()) {
          render();
        }
        return;
      case "add-work-item-owner":
        syncWorkItemOwnerSelection(target.closest("form"), { addFromSelect: true });
        return;
      case "remove-work-item-owner":
        syncWorkItemOwnerSelection(target.closest("form"), {
          removeOwnerId: target.getAttribute("data-owner-user-id") ?? "",
        });
        return;
      default:
        break;
    }

    const documentView = target.getAttribute("data-document-view");

    if (documentView === "write" || documentView === "split" || documentView === "preview") {
      setDocumentEditorView(documentView);
      render();
      return;
    }

    const markdownShortcut = target.getAttribute("data-markdown-shortcut");

    if (markdownShortcut) {
      applyMarkdownShortcut(markdownShortcut);
      return;
    }

    const workView = target.getAttribute("data-work-view");

    if (isWorkView(workView)) {
      state.workView = workView;
      replaceCurrentUrl();
      persistUiState();
      render();
      return;
    }

    const planDisplay = target.getAttribute("data-plan-display");

    if (isDisplayMode(planDisplay)) {
      state.planDisplay = planDisplay;
      replaceCurrentUrl();
      persistUiState();
      render();
      return;
    }

    const settingsSubview = target.getAttribute("data-settings-subview");

    if (isSettingsSubview(settingsSubview)) {
      state.settingsSubview = settingsSubview;
      pushCurrentUrl();
      render();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const editorField = target.getAttribute("data-editor-field");

    if (state.documentEditId && editorField) {
      updateDocumentEditorField(
        editorField,
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value,
      );
      return;
    }

    if (target.id === "space-select") {
      setActiveSpace(state, target.value);
      pushCurrentUrl();
      void refreshSnapshot();
      return;
    }

    if (target.id === "work-sort") {
      if (!isWorkSort(target.value)) {
        return;
      }

      state.workSort = target.value;
      replaceCurrentUrl();
      persistUiState();
      renderMainPanel();
      return;
    }

    if (target.id === "direct-type") {
      state.directType = target.value;
      replaceCurrentUrl();
      renderMainPanel();
      return;
    }

    if (target instanceof HTMLInputElement && target.name === "boardsScopeAll") {
      syncPermissionsMode(target.closest("form"), target.checked);
      return;
    }

    if (target instanceof HTMLInputElement && target.name === "useOverride") {
      syncHorizonOverrideMode(target.closest("form"), target.checked);
      return;
    }

    if (target instanceof HTMLSelectElement && target.name === "state") {
      const form = target.closest("form");
      const blockerRow = form?.querySelector("[data-blocker-row]");
      const blockerInput = form?.querySelector('input[name="blockedReason"]');
      const shouldShow = target.value === "Blocked";

      if (blockerRow instanceof HTMLElement) {
        blockerRow.toggleAttribute("hidden", !shouldShow);
        blockerRow.setAttribute("aria-hidden", String(!shouldShow));
      }

      if (blockerInput instanceof HTMLInputElement) {
        blockerInput.disabled = !shouldShow;

        if (!shouldShow) {
          blockerInput.value = "";
        }
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      const editorField = target.getAttribute("data-editor-field");

      if (
        state.documentEditId &&
        editorField &&
        !(target instanceof HTMLInputElement && target.type === "checkbox")
      ) {
        updateDocumentEditorField(editorField, target.value);
        return;
      }
    }

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.id === "work-search") {
      state.search = target.value;
      const cursor = target.selectionStart ?? target.value.length;
      replaceCurrentUrl();
      renderMainPanel();

      const nextInput = document.getElementById("work-search");

      if (nextInput instanceof HTMLInputElement) {
        nextInput.focus();
        nextInput.setSelectionRange(cursor, cursor);
      }

      return;
    }

    if (target.id === "direct-search") {
      state.directSearch = target.value;
      const cursor = target.selectionStart ?? target.value.length;
      replaceCurrentUrl();
      renderMainPanel();

      const nextInput = document.getElementById("direct-search");

      if (nextInput instanceof HTMLInputElement) {
        nextInput.focus();
        nextInput.setSelectionRange(cursor, cursor);
      }
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const formKind = form.dataset.form || form.id;

    if (formKind === "quick-capture-form") {
      event.preventDefault();
      void submitQuickCapture(form);
      return;
    }

    if (formKind === "auth-login") {
      event.preventDefault();
      void submitAuthEmail(form);
      return;
    }

    if (formKind === "signal-create-form") {
      event.preventDefault();
      void submitSignal(form);
      return;
    }

    if (formKind === "signal-detail-form") {
      event.preventDefault();
      void submitSignalUpdate(form);
      return;
    }

    if (formKind === "work-item-detail-form") {
      event.preventDefault();
      void submitWorkItemUpdate(form);
      return;
    }

    if (formKind === "signal-pull-form") {
      event.preventDefault();
      void submitSignalPull(form);
      return;
    }

    if (formKind === "document-detail-form") {
      event.preventDefault();
      void submitDocumentUpdate(form);
      return;
    }

    if (formKind === "space-create") {
      event.preventDefault();
      void submitSpaceCreate(form);
      return;
    }

    if (formKind === "space-update") {
      event.preventDefault();
      void submitSpaceUpdate(form);
      return;
    }

    if (formKind === "horizon-update") {
      event.preventDefault();
      void submitHorizonUpdate(form);
      return;
    }

    if (formKind === "horizon-default-update") {
      event.preventDefault();
      void submitHorizonDefaultUpdate(form);
      return;
    }

    if (formKind === "api-identity-create") {
      event.preventDefault();
      void submitApiIdentityCreate(form);
      return;
    }

    if (formKind === "api-identity-update") {
      event.preventDefault();
      void submitApiIdentityUpdate(form);
      return;
    }

    if (formKind === "user-create") {
      event.preventDefault();
      void submitUserCreate(form);
      return;
    }

    if (formKind === "user-update") {
      event.preventDefault();
      void submitUserUpdate(form);
      return;
    }

    if (formKind === "work-item-document-link") {
      event.preventDefault();
      void submitWorkItemDocumentLink(form);
      return;
    }

    if (formKind === "webhook-create") {
      event.preventDefault();
      void submitWebhookCreate(form);
      return;
    }

    if (formKind === "webhook-update") {
      event.preventDefault();
      void submitWebhookUpdate(form);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (handleDocumentEditorKeydown(event)) {
      return;
    }

    if (event.key === "Escape" && state.mobileNavOpen) {
      event.preventDefault();
      event.stopPropagation();
      state.mobileNavOpen = false;
      render();
      return;
    }

    if (event.key === "Escape" && state.confirmingModalClose) {
      event.preventDefault();
      event.stopPropagation();
      state.confirmingModalClose = false;
      render();
      return;
    }

    if (event.key === "Escape" && state.deleteConfirmation) {
      event.preventDefault();
      event.stopPropagation();
      state.deleteConfirmation = null;
      render();
      return;
    }

    if (event.key === "Escape" && hasOpenModal()) {
      event.preventDefault();
      event.stopPropagation();
      requestModalClose();
    }
  });

  document.addEventListener("dragstart", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const card = event.target.closest("[data-drag-id][data-drag-kind]");

    if (!card) {
      return;
    }

    state.dragPayload = {
      id: card.getAttribute("data-drag-id") ?? "",
      kind: card.getAttribute("data-drag-kind") ?? "",
      spaceId: card.getAttribute("data-drag-space-id") ?? "",
    };
    card.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(state.dragPayload));
    }

    document.body.classList.add("is-dragging-record");

    for (const zone of document.querySelectorAll("[data-drop-type]")) {
      if (!(zone instanceof HTMLElement)) {
        continue;
      }

      if (canDropOnZone(zone)) {
        zone.classList.add("is-drop-available");
      }
    }
  });

  document.addEventListener("dragover", (event) => {
    if (!state.dragPayload) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const dropZone = event.target.closest("[data-drop-type]");

    if (!dropZone || !canDropOnZone(dropZone)) {
      return;
    }

    event.preventDefault();

    if (currentDropZone === dropZone) {
      return;
    }

    clearDropZone();
    currentDropZone = dropZone;
    currentDropZone.classList.add("is-drop-target");
  });

  document.addEventListener("dragleave", (event) => {
    if (!currentDropZone) {
      return;
    }

    const related = event.relatedTarget;

    if (related instanceof Node && currentDropZone.contains(related)) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const dropZone = event.target.closest("[data-drop-state]");

    if (dropZone === currentDropZone) {
      clearDropZone();
    }
  });

  document.addEventListener("drop", (event) => {
    if (!state.dragPayload) {
      return;
    }

    if (!(event.target instanceof Element)) {
      state.dragPayload = null;
      clearDropFeedback();
      return;
    }

    const dropZone = event.target.closest("[data-drop-type]");

    clearDropFeedback();

    if (!dropZone || !canDropOnZone(dropZone)) {
      state.dragPayload = null;
      return;
    }

    event.preventDefault();

    const dragPayload = state.dragPayload;
    const dropType = dropZone.getAttribute("data-drop-type");
    state.dragPayload = null;

    if (dropType === "state") {
      const nextState = dropZone.getAttribute("data-drop-state");

      if (nextState && dragPayload.kind === "work-item") {
        void moveWorkItemToState(dragPayload.id, nextState);
      }

      return;
    }

    if (dropType === "horizon") {
      const horizonId = dropZone.getAttribute("data-drop-horizon-id");

      if (horizonId) {
        void moveRecordToHorizon(dragPayload, horizonId);
      }
    }
  });

  document.addEventListener("dragend", (event) => {
    if (!(event.target instanceof Element)) {
      state.dragPayload = null;
      clearDropFeedback();
      return;
    }

    const card = event.target.closest("[data-drag-id][data-drag-kind]");

    if (card) {
      card.classList.remove("is-dragging");
    }

    state.dragPayload = null;
    clearDropFeedback();
  });
}

async function copyCurrentViewLink() {
  await copyWithFeedback(buildViewUrl(state), "View link copied.", "Unable to copy the view link.");
}

async function copySelectedDocumentLink() {
  if (!state.selectedDocumentId) {
    return;
  }

  await copyWithFeedback(
    buildDocumentUrl(state.selectedDocumentId, state),
    "Document link copied.",
    "Unable to copy the document link.",
  );
}

async function copySelectedWorkItemContent() {
  const workItem = state.snapshot?.workItems.find((entry) => entry.id === state.selectedWorkItemId);

  if (!workItem) {
    return;
  }

  await copyWithFeedback(
    formatWorkItemForCopy(workItem),
    `${workItem.ref} copied.`,
    "Unable to copy the work item.",
  );
}

async function copySelectedWorkItemLink() {
  const workItem = state.snapshot?.workItems.find((entry) => entry.id === state.selectedWorkItemId);

  if (!workItem) {
    return;
  }

  await copyWithFeedback(
    buildWorkItemUrl(workItem, state),
    "Work item link copied.",
    "Unable to copy the work item link.",
  );
}

async function copyWithFeedback(value, successMessage, errorMessage) {
  try {
    await copyTextToClipboard(value);
    showSuccess(successMessage);
  } catch {
    showError(errorMessage);
  }
}

function syncWorkItemOwnerSelection(form, options = {}) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const ownerList = form.querySelector("[data-owner-list]");
  const ownerInputs = form.querySelector("[data-owner-inputs]");
  const ownerEmpty = form.querySelector("[data-owner-empty]");
  const ownerSelect = form.querySelector("[data-owner-select]");
  const addButton = form.querySelector('[data-action="add-work-item-owner"]');

  if (
    !(ownerList instanceof HTMLElement) ||
    !(ownerInputs instanceof HTMLElement) ||
    !(ownerEmpty instanceof HTMLElement) ||
    !(ownerSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  const removeOwnerId = String(options.removeOwnerId ?? "").trim();

  if (removeOwnerId) {
    ownerList.querySelector(`[data-owner-chip="${CSS.escape(removeOwnerId)}"]`)?.remove();
    ownerInputs.querySelector(`[data-owner-input="${CSS.escape(removeOwnerId)}"]`)?.remove();
  }

  if (options.addFromSelect) {
    const userId = ownerSelect.value.trim();

    if (userId && !ownerInputs.querySelector(`[data-owner-input="${CSS.escape(userId)}"]`)) {
      const selectedOption = ownerSelect.selectedOptions[0];
      const label = selectedOption?.getAttribute("data-owner-label") ?? selectedOption?.text ?? "";
      const meta = selectedOption?.getAttribute("data-owner-meta") ?? "";

      ownerList.append(createWorkItemOwnerChip(userId, label, meta));

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "ownerUserIds";
      hiddenInput.value = userId;
      hiddenInput.dataset.ownerInput = userId;
      ownerInputs.append(hiddenInput);
    }
  }

  const selectedOwnerIds = new Set(
    Array.from(ownerInputs.querySelectorAll('input[name="ownerUserIds"]')).map((input) =>
      input instanceof HTMLInputElement ? input.value : "",
    ),
  );

  Array.from(ownerSelect.options).forEach((option) => {
    if (!option.value) {
      option.disabled = false;
      return;
    }

    option.disabled = selectedOwnerIds.has(option.value);
  });

  if (!ownerSelect.value || selectedOwnerIds.has(ownerSelect.value)) {
    const nextOption = Array.from(ownerSelect.options).find(
      (option) => option.value && !option.disabled,
    );
    ownerSelect.value = nextOption?.value ?? "";
  }

  ownerEmpty.hidden = selectedOwnerIds.size > 0;

  if (addButton instanceof HTMLButtonElement) {
    addButton.disabled = !ownerSelect.value;
  }
}

function createWorkItemOwnerChip(userId, label, meta) {
  const chip = document.createElement("span");
  chip.className = "work-item-owner-chip";
  chip.dataset.ownerChip = userId;

  const copy = document.createElement("span");
  copy.className = "work-item-owner-chip-copy";

  const labelElement = document.createElement("span");
  labelElement.className = "work-item-owner-chip-label";
  labelElement.textContent = label;
  copy.append(labelElement);

  if (meta) {
    const metaElement = document.createElement("span");
    metaElement.className = "work-item-owner-chip-meta";
    metaElement.textContent = meta;
    copy.append(metaElement);
  }

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "work-item-owner-chip-remove";
  removeButton.dataset.action = "remove-work-item-owner";
  removeButton.dataset.ownerUserId = userId;
  removeButton.setAttribute("aria-label", `Remove ${label}`);
  removeButton.textContent = "×";

  chip.append(copy, removeButton);
  return chip;
}

function syncPermissionsMode(form, useAllBoards) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const allBoardsField = form.querySelector("[data-permissions-all-boards]");
  const boardGrantsField = form.querySelector("[data-permissions-board-grants]");
  const allBoardsSelect = form.querySelector('select[name="boardsAllLevel"]');
  const boardGrantSelects = form.querySelectorAll('select[name^="boardLevel:"]');

  if (allBoardsField instanceof HTMLElement) {
    allBoardsField.toggleAttribute("hidden", !useAllBoards);
    allBoardsField.setAttribute("aria-hidden", String(!useAllBoards));
  }

  if (boardGrantsField instanceof HTMLElement) {
    boardGrantsField.toggleAttribute("hidden", useAllBoards);
    boardGrantsField.setAttribute("aria-hidden", String(useAllBoards));
  }

  if (allBoardsSelect instanceof HTMLSelectElement) {
    allBoardsSelect.disabled = !useAllBoards;
  }

  for (const select of boardGrantSelects) {
    if (select instanceof HTMLSelectElement) {
      select.disabled = useAllBoards;
    }
  }
}

function syncHorizonOverrideMode(form, useOverride) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  for (const field of form.querySelectorAll("[data-horizon-override-field]")) {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.disabled = !useOverride;
    }
  }
}

function clearDropZone() {
  if (!currentDropZone) {
    return;
  }

  currentDropZone.classList.remove("is-drop-target");
  currentDropZone = null;
}

function clearDropFeedback() {
  clearDropZone();
  document.body.classList.remove("is-dragging-record");

  for (const zone of document.querySelectorAll(".is-drop-available")) {
    zone.classList.remove("is-drop-available");
  }
}

function canDropOnZone(dropZone) {
  if (!state.dragPayload) {
    return false;
  }

  const dropType = dropZone.getAttribute("data-drop-type");
  const dropSpaceId = dropZone.getAttribute("data-drop-space-id") ?? "";

  if (dropType === "state") {
    return state.dragPayload.kind === "work-item";
  }

  if (dropType === "horizon") {
    return !dropSpaceId || !state.dragPayload.spaceId || dropSpaceId === state.dragPayload.spaceId;
  }

  return false;
}
