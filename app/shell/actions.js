import { clearAuthTokens } from "../auth/tokens.js";
import { apiFetch } from "../core/api.js";
import {
  hasUnsavedDocumentEditorChanges,
  saveDocumentEditor,
  startDocumentEditing,
  stopDocumentEditing,
} from "../documents/documentEditor.js";
import {
  pushCurrentUrl,
  replaceCurrentUrl,
  syncRouteSelectionFromSnapshot,
} from "../routing/navigation.js";
import {
  canCurrentUserEditDocuments,
  getUserDisplayName,
  hasOpenModal,
  normalizeSelection,
  readErrorMessage,
} from "../shared/helpers.js";
import { state } from "../state/state.js";
import { isGlobalArea } from "../state/uiOptions.js";
import {
  clearDocumentSelection,
  clearSignalSelection,
  clearWorkItemSelection,
  closeModalUi,
  openDocumentUi,
  openSettingsUi,
  openSignalUi,
  openWorkItemUi,
  setActiveArea,
} from "../state/uiStateTransitions.js";
import { showError, showSuccess, showWarning } from "../ui/notifications.js";
import { render } from "../ui/render.js";

const AUTH_SESSION_KEY = "mikrolens-auth-session";

export async function refreshSnapshot() {
  const hadSnapshot = Boolean(state.snapshot);
  state.loading = true;
  state.error = "";
  render();

  try {
    const query =
      !isGlobalArea(state.activeArea) && state.activeSpaceId
        ? `?spaceId=${encodeURIComponent(state.activeSpaceId)}`
        : "";
    const [snapshotResponse, spacesResponse, capabilities, allDocumentsResponse] =
      await Promise.all([
        apiFetch(`/api/bootstrap${query}`),
        apiFetch("/api/spaces"),
        loadCapabilities(),
        apiFetch("/api/documents").catch(() => null),
      ]);

    if (snapshotResponse.status === 401 || spacesResponse.status === 401) {
      routeToAuthAfterUnauthorizedLoad();
      return;
    }

    if (!snapshotResponse.ok) {
      throw new Error(`Unable to load MikroLens (${snapshotResponse.status}).`);
    }

    if (!spacesResponse.ok) {
      throw new Error(`Unable to load spaces (${spacesResponse.status}).`);
    }

    state.snapshot = await snapshotResponse.json();
    state.spaceOptions = await spacesResponse.json();
    state.capabilities = capabilities;
    state.allDocuments = allDocumentsResponse?.ok
      ? await allDocumentsResponse.json()
      : [...state.snapshot.documents];
    syncRouteSelectionFromSnapshot();
    normalizeSelection();

    if (state.selectedDocumentId) {
      await ensureDocumentDetail(state.selectedDocumentId, { force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown load failure.";

    if (hadSnapshot) {
      showError(message);
    } else {
      state.error = message;
    }
  } finally {
    state.loading = false;
    replaceCurrentUrl();
    render();
  }
}

function routeToAuthAfterUnauthorizedLoad() {
  clearAuthTokens();
  localStorage.removeItem(AUTH_SESSION_KEY);
  state.auth.currentUserEmail = "";
  state.auth.currentUserId = "";
  state.auth.currentUserRole = "";
  state.auth.permissions = [];
  state.auth.isAuthenticated = false;
  state.auth.pending = false;
  state.auth.pendingDemoUserId = "";
  state.auth.pendingEmail = "";
  state.auth.requiresAuthentication = true;
  state.auth.screen = "form";
  state.error = "";
  state.mobileNavOpen = false;
}

async function loadCapabilities() {
  try {
    const response = await apiFetch("/openapi.json");

    if (!response.ok) {
      return {
        canDeleteDocuments: false,
        canDeleteSignals: false,
        canDeleteWorkItems: false,
        canEditDocuments: false,
      };
    }

    const schema = await response.json();
    const documentPath = schema?.paths?.["/api/documents/{id}"] ?? {};
    const signalPath = schema?.paths?.["/api/signals/{id}"] ?? {};
    const workItemPath = schema?.paths?.["/api/work-items/{id}"] ?? {};

    return {
      canDeleteDocuments: Boolean(documentPath.delete),
      canDeleteSignals: Boolean(signalPath.delete),
      canDeleteWorkItems: Boolean(workItemPath.delete),
      canEditDocuments: Boolean(documentPath.patch || documentPath.put),
    };
  } catch {
    return {
      canDeleteDocuments: false,
      canDeleteSignals: false,
      canDeleteWorkItems: false,
      canEditDocuments: false,
    };
  }
}

export async function ensureDocumentDetail(documentId, options = {}) {
  if (state.documentDetailsById.has(documentId) && !options.force) {
    return;
  }

  state.documentDetailStatusById.set(documentId, {
    kind: "loading",
  });
  render();

  try {
    const response = await apiFetch(`/api/documents/${documentId}`);

    if (!response.ok) {
      throw new Error("Document detail is unavailable.");
    }

    const detail = await response.json();
    validateDocumentDetail(detail);
    state.documentDetailsById.set(documentId, detail);
    state.documentDetailStatusById.set(documentId, {
      kind: "ready",
    });
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load document detail.";
    state.documentDetailStatusById.set(documentId, {
      kind: "error",
      message,
    });
    if (state.selectedDocumentId === documentId) {
      showError(message);
    }
    render();
  }
}

function validateDocumentDetail(detail) {
  if (!detail || typeof detail !== "object") {
    throw new Error("Document detail response was empty.");
  }

  const requiredStringFields = ["id", "title", "type", "markdown", "createdAt", "updatedAt"];

  for (const field of requiredStringFields) {
    if (typeof detail[field] !== "string" || detail[field].length === 0) {
      throw new Error(`Document detail is missing ${field}.`);
    }
  }

  if (typeof detail.summary !== "string") {
    throw new Error("Document detail is missing summary.");
  }

  if (
    detail.spaceId !== null &&
    (typeof detail.spaceId !== "string" || detail.spaceId.length === 0)
  ) {
    throw new Error("Document detail has an invalid spaceId.");
  }

  if (
    detail.spaceName !== null &&
    (typeof detail.spaceName !== "string" || detail.spaceName.length === 0)
  ) {
    throw new Error("Document detail has an invalid spaceName.");
  }

  if (!Array.isArray(detail.linkedWorkItems)) {
    throw new Error("Document detail is missing linked work items.");
  }
}

export async function submitQuickCapture(form) {
  const formData = new FormData(form);
  const title = String(formData.get("title") ?? "").trim();
  const spaceId = String(formData.get("spaceId") ?? "").trim();

  if (!title || !spaceId) {
    showError("Quick capture needs a title and a space.");
    return;
  }

  const response = await apiFetch("/api/work-items", {
    body: JSON.stringify({
      spaceId,
      summary: String(formData.get("summary") ?? "").trim(),
      title,
      type: String(formData.get("type") ?? "Task"),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Quick capture failed."));
    return;
  }

  const workItem = await response.json();
  setActiveArea(state, "Work");
  state.activeSpaceId = workItem.spaceId;
  openWorkItemUi(state, {
    id: workItem.id,
    routeKey: workItem.ref,
  });
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${workItem.ref} captured.`);
}

export async function submitSignal(form) {
  const formData = new FormData(form);
  const title = String(formData.get("title") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();

  if (!title || !source) {
    showError("Signals need both a title and a source.");
    return;
  }

  const response = await apiFetch("/api/signals", {
    body: JSON.stringify({
      expectedTimeline: String(formData.get("expectedTimeline") ?? "").trim() || null,
      summary: String(formData.get("summary") ?? "").trim(),
      source,
      title,
      urgency: String(formData.get("urgency") ?? "Medium"),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to capture the signal."));
    return;
  }

  const signal = await response.json();
  setActiveArea(state, "Intake");
  closeModalUi(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${signal.ref} captured.`);
}

export async function submitSignalUpdate(form) {
  const signalId = form.dataset.signalId;

  if (!signalId) {
    return;
  }

  const formData = new FormData(form);
  const title = String(formData.get("title") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();

  if (!title || !source) {
    showError("Signals need both a title and a source.");
    return;
  }

  const response = await apiFetch(`/api/signals/${signalId}`, {
    body: JSON.stringify({
      expectedTimeline: String(formData.get("expectedTimeline") ?? "").trim() || null,
      source,
      summary: String(formData.get("summary") ?? "").trim(),
      title,
      urgency: String(formData.get("urgency") ?? "Medium"),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the signal."));
    return;
  }

  const updated = await response.json();
  await refreshSnapshot();
  showSuccess(`${updated.ref} saved.`);
}

export async function submitSignalPull(form) {
  const signalId = form.dataset.signalId;

  if (!signalId) {
    return;
  }

  const formData = new FormData(form);
  const targetSpaceId = String(formData.get("targetSpaceId") ?? "").trim();

  if (!targetSpaceId) {
    showError("Choose a space to pull this signal into.");
    return;
  }

  const response = await apiFetch(`/api/signals/${signalId}/pull`, {
    body: JSON.stringify({
      targetSpaceId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to pull the signal."));
    return;
  }

  const pulled = await response.json();
  setActiveArea(state, "Intake");
  clearSignalSelection(state);
  clearWorkItemSelection(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${pulled.ref} pulled into ${pulled.space.name}.`);
}

export async function submitWorkItemUpdate(form) {
  const workItemId = form.dataset.workItemId;

  if (!workItemId) {
    return;
  }

  const formData = new FormData(form);
  const ownerUserIds = Array.from(
    new Set(
      formData
        .getAll("ownerUserIds")
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
  const ownerName =
    ownerUserIds
      .map((ownerUserId) => state.snapshot?.users.find((user) => user.id === ownerUserId) ?? null)
      .filter(Boolean)
      .map((user) => getUserDisplayName(user))
      .join(", ") || null;
  const response = await apiFetch(`/api/work-items/${workItemId}`, {
    body: JSON.stringify({
      blockedReason: formData.has("blockedReason")
        ? String(formData.get("blockedReason") ?? "")
        : undefined,
      horizonId: String(formData.get("horizonId") ?? ""),
      ownerName,
      ownerUserIds,
      state: String(formData.get("state") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      targetEndDate: String(formData.get("targetEndDate") ?? "") || null,
      targetStartDate: String(formData.get("targetStartDate") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      type: String(formData.get("type") ?? ""),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save work item changes."));
    return;
  }

  const updated = await response.json();
  clearWorkItemSelection(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.ref} saved.`);
}

export async function submitDocumentUpdate(form) {
  if (
    !form.dataset.documentId ||
    !state.capabilities.canEditDocuments ||
    !canCurrentUserEditDocuments()
  ) {
    showWarning("Document editing is not available in the current API.");
    return;
  }
  await saveDocumentEditor({ manual: true });
}

export async function createDocumentRecord() {
  if (!canCurrentUserEditDocuments()) {
    showError("Document access is required.");
    return;
  }

  const spaceId = state.activeSpaceId?.trim() ?? "";
  const payload = {};

  if (spaceId) {
    payload.spaceId = spaceId;
  }

  const response = await apiFetch("/api/documents", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the document."));
    return;
  }

  const document = await response.json();
  setActiveArea(state, "Direct");
  openDocumentUi(state, document.id);
  pushCurrentUrl();
  await refreshSnapshot();

  if (state.capabilities.canEditDocuments) {
    const detail = state.documentDetailsById.get(document.id);

    if (detail) {
      startDocumentEditing(detail);
      render();
    }
  }

  showSuccess("New document ready.");
}

export async function submitWorkItemDocumentLink(form) {
  const workItemId = form.dataset.workItemId;

  if (!workItemId) {
    return;
  }

  const formData = new FormData(form);
  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!documentId) {
    showError("Choose a document to link.");
    return;
  }

  const response = await apiFetch(`/api/work-items/${workItemId}/document-links`, {
    body: JSON.stringify({
      documentId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to link the document."));
    return;
  }

  const linkedWorkItem = await response.json();
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(
    linkedWorkItem?.title
      ? `${linkedWorkItem.title} linked to the selected work item.`
      : "Document linked.",
  );
}

export async function unlinkWorkItemDocument(workItemId, documentId) {
  if (!workItemId || !documentId) {
    return;
  }

  const response = await apiFetch(`/api/work-items/${workItemId}/document-links/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to unlink the document."));
    return;
  }

  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess("Document unlinked.");
}

export async function deleteWorkItemRecord(workItemId) {
  const response = await apiFetch(`/api/work-items/${workItemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to remove the work item."));
    return;
  }

  const deleted = await response.json();
  state.deleteConfirmation = null;
  clearWorkItemSelection(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${deleted.ref} removed.`);
}

export async function deleteSignalRecord(signalId) {
  const response = await apiFetch(`/api/signals/${signalId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to remove the signal."));
    return;
  }

  const deleted = await response.json();
  state.deleteConfirmation = null;
  clearSignalSelection(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${deleted.ref} removed.`);
}

export async function deleteDocumentRecord(documentId) {
  const response = await apiFetch(`/api/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to remove the document."));
    return;
  }

  const deleted = await response.json();
  state.deleteConfirmation = null;
  state.documentDetailsById.delete(documentId);
  state.documentDetailStatusById.delete(documentId);
  clearDocumentSelection(state);
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${deleted.title} removed.`);
}

export async function submitSpaceCreate(form) {
  const formData = new FormData(form);
  const response = await apiFetch("/api/spaces", {
    body: JSON.stringify({
      accent: String(formData.get("accent") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the space."));
    return;
  }

  const created = await response.json();
  setActiveArea(state, "Settings");
  state.activeSpaceId = "";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${created.name} created.`);
}

export async function submitSpaceUpdate(form) {
  const spaceId = form.dataset.spaceId;

  if (!spaceId) {
    return;
  }

  const formData = new FormData(form);
  const response = await apiFetch(`/api/spaces/${spaceId}`, {
    body: JSON.stringify({
      accent: String(formData.get("accent") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the space."));
    return;
  }

  const updated = await response.json();
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.name} saved.`);
}

export async function submitHorizonCreate(form) {
  const formData = new FormData(form);
  const response = await apiFetch("/api/horizons", {
    body: JSON.stringify({
      description: String(formData.get("description") ?? "").trim(),
      label: String(formData.get("label") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      spaceId: String(formData.get("spaceId") ?? "").trim(),
      windowEndDays: Number(formData.get("windowEndDays") ?? 0),
      windowStartDays: Number(formData.get("windowStartDays") ?? 0),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the horizon."));
    return;
  }

  const created = await response.json();
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${created.label} created.`);
}

export async function submitHorizonUpdate(form) {
  const horizonId = form.dataset.horizonId;

  if (!horizonId) {
    return;
  }

  const formData = new FormData(form);
  const response = await apiFetch(`/api/horizons/${horizonId}`, {
    body: JSON.stringify({
      description: String(formData.get("description") ?? "").trim(),
      label: String(formData.get("label") ?? "").trim(),
      timeframeText: String(formData.get("timeframeText") ?? "").trim(),
      useDefaults: formData.get("useOverride") !== "on",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the horizon."));
    return;
  }

  const updated = await response.json();
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.label} saved.`);
}

export async function submitHorizonDefaultUpdate(form) {
  const horizonDefaultKey = form.dataset.horizonDefaultKey;

  if (!horizonDefaultKey) {
    return;
  }

  const formData = new FormData(form);
  const response = await apiFetch(`/api/horizon-defaults/${horizonDefaultKey}`, {
    body: JSON.stringify({
      description: String(formData.get("description") ?? "").trim(),
      label: String(formData.get("label") ?? "").trim(),
      timeframeText: String(formData.get("timeframeText") ?? "").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the horizon defaults."));
    return;
  }

  const updated = await response.json();
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.label} defaults saved.`);
}

export async function submitApiIdentityCreate(form) {
  const formData = new FormData(form);
  const response = await apiFetch("/api/api-identities", {
    body: JSON.stringify({
      description: String(formData.get("description") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      permissions: buildPermissionsPayload(formData),
      status: String(formData.get("status") ?? "Active").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the API identity."));
    return;
  }

  const created = await response.json();
  setActiveArea(state, "Settings");
  state.settingsSubview = "api-identities";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${created.apiIdentity.name} created.`);
  openSettingsUi(
    state,
    {
      apiIdentityId: created.apiIdentity.id,
      apiIdentityName: created.apiIdentity.name,
      kind: "api-identity-token",
      reason: "created",
      token: created.token,
    },
    { settingsSubview: "api-identities" },
  );
  render();
}

export async function submitApiIdentityUpdate(form) {
  const apiIdentityId = form.dataset.apiIdentityId;

  if (!apiIdentityId) {
    return;
  }

  const formData = new FormData(form);
  const response = await apiFetch(`/api/api-identities/${apiIdentityId}`, {
    body: JSON.stringify({
      description: String(formData.get("description") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      permissions: buildPermissionsPayload(formData),
      status: String(formData.get("status") ?? "Active").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the API identity."));
    return;
  }

  const updated = await response.json();
  state.settingsSubview = "api-identities";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.name} saved.`);
}

export async function rotateApiIdentityToken(apiIdentityId) {
  const response = await apiFetch(`/api/api-identities/${apiIdentityId}/rotate-token`, {
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to rotate the API identity token."));
    return;
  }

  const rotated = await response.json();
  state.settingsSubview = "api-identities";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${rotated.apiIdentity.name} token rotated.`);
  openSettingsUi(
    state,
    {
      apiIdentityId: rotated.apiIdentity.id,
      apiIdentityName: rotated.apiIdentity.name,
      kind: "api-identity-token",
      reason: "rotated",
      token: rotated.token,
    },
    { settingsSubview: "api-identities" },
  );
  render();
}

export async function submitUserCreate(form) {
  const formData = new FormData(form);
  const response = await apiFetch("/api/users", {
    body: JSON.stringify({
      email: String(formData.get("email") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim() || null,
      permissions: buildPermissionsPayload(formData),
      role: String(formData.get("role") ?? "User").trim(),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the user."));
    return;
  }

  const created = await response.json();
  setActiveArea(state, "Settings");
  state.settingsSubview = "users";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`Invitation sent to ${created.email}.`);
}

export async function submitUserUpdate(form) {
  const userId = form.dataset.userId;

  if (!userId) {
    return;
  }

  const isCurrentUser = userId === state.auth.currentUserId;
  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") ?? "").trim() || null,
  };

  if (!isCurrentUser) {
    payload.permissions = buildPermissionsPayload(formData);
    payload.role = String(formData.get("role") ?? "User").trim();
  }

  const response = await apiFetch(`/api/users/${userId}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the user."));
    return;
  }

  const updated = await response.json();
  state.settingsSubview = "users";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.name || updated.email} saved.`);
}

export async function submitWebhookCreate(form) {
  const formData = new FormData(form);
  const response = await apiFetch("/api/webhooks", {
    body: JSON.stringify(buildWebhookPayload(formData)),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to create the webhook endpoint."));
    return;
  }

  const created = await response.json();
  setActiveArea(state, "Settings");
  state.settingsSubview = "webhooks";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${created.name} created.`);
}

export async function submitWebhookUpdate(form) {
  const webhookId = form.dataset.webhookId;

  if (!webhookId) {
    return;
  }

  const formData = new FormData(form);
  const response = await apiFetch(`/api/webhooks/${webhookId}`, {
    body: JSON.stringify(buildWebhookPayload(formData)),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to save the webhook endpoint."));
    return;
  }

  const updated = await response.json();
  state.settingsSubview = "webhooks";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${updated.name} saved.`);
}

export async function deleteWebhookEndpoint(webhookId) {
  const response = await apiFetch(`/api/webhooks/${webhookId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to delete the webhook endpoint."));
    return;
  }

  state.settingsSubview = "webhooks";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess("Webhook deleted.");
}

export async function deleteUserRecord(userId) {
  const response = await apiFetch(`/api/users/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to delete the user."));
    return;
  }

  const deleted = await response.json();
  state.settingsSubview = "users";
  state.settingsModal = null;
  pushCurrentUrl();
  await refreshSnapshot();
  showSuccess(`${deleted.email} deleted.`);
}

function buildPermissionsPayload(formData) {
  const boardsScopeAll = formData.get("boardsScopeAll");
  const boardsScope =
    boardsScopeAll === "on" || boardsScopeAll === "true" || boardsScopeAll === "1"
      ? "all"
      : "boards";

  return {
    boards:
      boardsScope === "all"
        ? {
            level: normalizeAccessLevel(formData.get("boardsAllLevel")),
            scope: "all",
          }
        : {
            grants: (state.snapshot?.spaces ?? [])
              .map((space) => ({
                boardId: space.id,
                level: String(formData.get(`boardLevel:${space.id}`) ?? "").trim(),
              }))
              .filter((grant) => grant.level),
            scope: "boards",
          },
    documents: normalizeAccessLevel(formData.get("documentsLevel")),
    signals: normalizeAccessLevel(formData.get("signalsLevel")),
  };
}

function buildWebhookPayload(formData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    secret: String(formData.get("secret") ?? "").trim(),
    spaceId: String(formData.get("spaceId") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Active").trim(),
    subscribedEvents: formData
      .getAll("subscribedEvents")
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
    url: String(formData.get("url") ?? "").trim(),
  };
}

function normalizeAccessLevel(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function moveWorkItemToState(workItemId, nextState) {
  const workItem = state.snapshot?.workItems.find((item) => item.id === workItemId);

  if (!workItem || workItem.state === nextState) {
    return;
  }

  const response = await apiFetch(`/api/work-items/${workItemId}`, {
    body: JSON.stringify({
      state: nextState,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    showError(await readErrorMessage(response, "Unable to move the work item."));
    return;
  }

  const updated = await response.json();
  await refreshSnapshot();
  showSuccess(`${updated.ref} moved to ${updated.state}.`);
}

export async function moveRecordToHorizon(dragPayload, horizonId) {
  if (dragPayload.kind === "work-item") {
    const workItem = state.snapshot?.workItems.find((item) => item.id === dragPayload.id);

    if (!workItem || workItem.horizon.id === horizonId) {
      return;
    }

    const response = await apiFetch(`/api/work-items/${dragPayload.id}`, {
      body: JSON.stringify({
        horizonId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });

    if (!response.ok) {
      showError(await readErrorMessage(response, "Unable to move the work item in Plan."));
      return;
    }

    const updated = await response.json();
    await refreshSnapshot();
    showSuccess(`${updated.ref} moved to ${updated.horizon.label ?? updated.horizon.name}.`);
    return;
  }

  if (dragPayload.kind === "document") {
    const detail = state.documentDetailsById.get(dragPayload.id);
    const document =
      detail ?? state.snapshot?.documents.find((entry) => entry.id === dragPayload.id) ?? null;

    if (!document || !state.capabilities.canEditDocuments || !canCurrentUserEditDocuments()) {
      return;
    }

    const currentHorizonId =
      detail?.horizonId ??
      state.snapshot?.horizons.find(
        (horizon) =>
          horizon.spaceId === document.spaceId && horizon.key === (document.horizonKey ?? ""),
      )?.id ??
      null;

    if (currentHorizonId === horizonId) {
      return;
    }

    if (!detail) {
      await ensureDocumentDetail(dragPayload.id, { force: true });
    }

    const latestDetail = state.documentDetailsById.get(dragPayload.id);

    if (!latestDetail) {
      showError("Unable to load the document for moving.");
      return;
    }

    const response = await apiFetch(`/api/documents/${dragPayload.id}`, {
      body: JSON.stringify({
        horizonId,
        markdown: latestDetail.markdown,
        summary: latestDetail.summary,
        title: latestDetail.title,
        type: latestDetail.type,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });

    if (!response.ok) {
      showError(await readErrorMessage(response, "Unable to move the document in Plan."));
      return;
    }

    const updated = await response.json();
    state.documentDetailsById.set(updated.id, updated);
    await refreshSnapshot();
    showSuccess(`${updated.title} moved to ${updated.horizonName ?? "No horizon"}.`);
  }
}

export function openWorkItem(workItemId) {
  stopDocumentEditing();
  const selectedWorkItem = state.snapshot?.workItems.find((item) => item.id === workItemId) ?? null;

  openWorkItemUi(state, {
    id: workItemId,
    routeKey: selectedWorkItem?.ref ?? workItemId,
  });
  pushCurrentUrl();
  render();
}

export function openSignal(signalId) {
  stopDocumentEditing();
  const selectedSignal = state.snapshot?.signals.find((item) => item.id === signalId) ?? null;

  openSignalUi(state, {
    id: signalId,
    routeKey: selectedSignal?.ref ?? signalId,
  });
  pushCurrentUrl();
  render();
}

export function openDocument(documentId) {
  if (state.selectedDocumentId !== documentId) {
    stopDocumentEditing();
  }

  openDocumentUi(state, documentId);
  pushCurrentUrl();
  void ensureDocumentDetail(documentId);
  render();
}

export function syncWorkItemDocsDrawer() {
  const modalGrid = document.querySelector(".modal-grid-work-item");
  const sidebar = document.querySelector(".modal-sidebar-collapsible");
  const toggle = document.querySelector('[data-action="toggle-work-item-docs"]');
  const title = document.querySelector(".collapsible-panel-title");

  if (
    !(modalGrid instanceof HTMLElement) ||
    !(sidebar instanceof HTMLElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(title instanceof HTMLElement)
  ) {
    return false;
  }

  modalGrid.classList.toggle("is-sidebar-collapsed", state.workItemDocsCollapsed);
  sidebar.classList.toggle("is-collapsed", state.workItemDocsCollapsed);
  toggle.setAttribute("aria-expanded", String(!state.workItemDocsCollapsed));
  title.textContent = state.workItemDocsCollapsed ? "Docs" : "Linked documents";
  return true;
}

export function closeModal() {
  stopDocumentEditing();
  closeModalUi(state);
  pushCurrentUrl();
  render();
}

export function requestModalClose() {
  if (!hasOpenModal() || state.confirmingModalClose) {
    return;
  }

  if (!state.documentEditId || !hasUnsavedDocumentEditorChanges()) {
    closeModal();
    return;
  }

  state.confirmingModalClose = true;
  render();
}
