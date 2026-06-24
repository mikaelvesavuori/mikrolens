import { apiFetch, createApiEventSource } from "../core/api.js";
import { generateId } from "../core/id.js";
import { copyTextToClipboard } from "../shared/clipboard.js";
import {
  canCurrentUserEditDocuments,
  escapeHtml,
  formatDateTime,
  renderMarkdown,
} from "../shared/helpers.js";
import { state } from "../state/state.js";
import { showError, showSuccess } from "../ui/notifications.js";
import { renderStyleAttribute } from "../ui/renderShared.js";

const COLLABORATION_IDENTITY_KEY = "mikrolens-collaboration-identity";
const DRAFT_SYNC_DEBOUNCE_MS = 180;
const PRESENCE_HEARTBEAT_MS = 12_000;
const REMOTE_APPLY_DELAY_MS = 900;
const SAVE_DEBOUNCE_MS = 1_400;

const runtime = {
  copyTimer: 0,
  draftTimer: 0,
  eventSource: null,
  pendingRemoteTimer: 0,
  presenceTimer: 0,
  saveTimer: 0,
  streamDocumentId: "",
};

export function startDocumentEditing(detail) {
  if (!detail) {
    return;
  }

  const previousView = state.documentEditor?.view ?? "write";
  const previousInspectorOpen = state.documentEditor?.inspectorOpen ?? false;
  state.documentEditId = detail.id;
  state.documentEditor = {
    collaborators: [],
    connectionState: "connecting",
    copyState: "idle",
    dirty: false,
    horizonId: detail.horizonId ?? null,
    id: detail.id,
    initialUpdatedAt: detail.updatedAt,
    lastLocalEditAt: 0,
    lastSavedAt: detail.updatedAt,
    markdown: detail.markdown,
    pendingRemoteDraft: null,
    remoteNotice: "",
    saveError: "",
    saveState: "saved",
    summary: detail.summary,
    title: detail.title,
    type: detail.type,
    inspectorOpen: previousInspectorOpen,
    view: previousView,
  };
}

export function stopDocumentEditing() {
  tearDownRuntime();
  state.documentEditor = null;
}

export function hasUnsavedDocumentEditorChanges() {
  return Boolean(
    state.documentEditor &&
      (state.documentEditor.dirty || state.documentEditor.saveState === "saving"),
  );
}

export function setDocumentEditorView(view) {
  if (!state.documentEditor) {
    return;
  }

  state.documentEditor.view = view === "preview" || view === "write" ? view : "split";
}

export function toggleDocumentEditorInspector() {
  if (!state.documentEditor) {
    return;
  }

  state.documentEditor.inspectorOpen = !state.documentEditor.inspectorOpen;
}

export function updateDocumentEditorField(field, value) {
  const editor = state.documentEditor;

  if (!editor) {
    return;
  }

  editor[field] = value;
  editor.dirty = true;
  editor.lastLocalEditAt = Date.now();
  editor.remoteNotice = "";
  editor.saveError = "";
  editor.saveState = "dirty";
  scheduleDraftSync();
  scheduleSave();
  syncDocumentEditorSurface();
}

export function applyMarkdownShortcut(shortcut) {
  const editor = state.documentEditor;
  const textarea = document.querySelector('[data-editor-field="markdown"]');

  if (!editor || editor.view === "preview" || !(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const selectionStart = textarea.selectionStart ?? 0;
  const selectionEnd = textarea.selectionEnd ?? selectionStart;
  const selected = textarea.value.slice(selectionStart, selectionEnd);
  const next = getShortcutTransform(shortcut, selected);

  if (!next) {
    return;
  }

  textarea.setRangeText(next.text, selectionStart, selectionEnd, "end");
  textarea.focus();
  textarea.setSelectionRange(
    selectionStart + next.selectionStartOffset,
    selectionStart + next.selectionEndOffset,
  );
  updateDocumentEditorField("markdown", textarea.value);
}

export async function saveDocumentEditor(options = {}) {
  const editor = state.documentEditor;

  if (!editor || !state.capabilities.canEditDocuments || !canCurrentUserEditDocuments()) {
    return false;
  }

  clearTimeout(runtime.saveTimer);

  if (!editor.dirty && editor.saveState !== "error") {
    return true;
  }

  editor.saveState = "saving";
  editor.saveError = "";
  syncDocumentEditorSurface();

  const identity = getCollaborationIdentity();

  try {
    const response = await apiFetch(`/api/documents/${editor.id}`, {
      body: JSON.stringify({
        clientId: identity.clientId,
        horizonId: editor.horizonId,
        markdown: editor.markdown,
        summary: editor.summary,
        title: editor.title,
        type: editor.type,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response, "Unable to save document changes."));
    }

    const detail = await response.json();
    state.documentDetailsById.set(editor.id, detail);
    state.documentDetailStatusById.set(editor.id, {
      kind: "ready",
    });
    syncDocumentSummary(detail);

    editor.dirty = false;
    editor.horizonId = detail.horizonId ?? null;
    editor.initialUpdatedAt = detail.updatedAt;
    editor.lastSavedAt = detail.updatedAt;
    editor.markdown = detail.markdown;
    editor.pendingRemoteDraft = null;
    editor.remoteNotice = "";
    editor.saveError = "";
    editor.saveState = "saved";
    editor.summary = detail.summary;
    editor.title = detail.title;
    editor.type = detail.type;

    syncDocumentEditorSurface();

    return true;
  } catch (error) {
    editor.saveState = "error";
    editor.saveError = error instanceof Error ? error.message : "Unable to save document changes.";
    syncDocumentEditorSurface();

    if (options.manual) {
      showError(editor.saveError);
    }

    return false;
  }
}

export function handleDocumentEditorKeydown(event) {
  if (!state.documentEditor) {
    return false;
  }

  const target = event.target;
  const isWithinEditor =
    target instanceof HTMLElement && Boolean(target.closest("#document-detail-form"));
  const isMarkdownField =
    target instanceof HTMLTextAreaElement &&
    target.getAttribute("data-editor-field") === "markdown";

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && isWithinEditor) {
    event.preventDefault();
    void saveDocumentEditor({ manual: true });
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && !event.altKey && isMarkdownField) {
    const shortcut = getShortcutFromKeyboardEvent(event);

    if (shortcut) {
      event.preventDefault();
      applyMarkdownShortcut(shortcut);
      return true;
    }
  }

  if (event.key === "Tab" && isMarkdownField) {
    event.preventDefault();
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? start;
    target.setRangeText("  ", start, end, "end");
    updateDocumentEditorField("markdown", target.value);
    return true;
  }

  return false;
}

export async function copyDocumentEditorContent() {
  const editor = state.documentEditor;

  if (!editor) {
    return false;
  }

  try {
    await copyTextToClipboard(serializeDocumentAsMarkdown(editor));
    setDocumentEditorCopyState("copied");
    showSuccess("Document copied.");
    return true;
  } catch {
    showError("Unable to copy the document.");
    return false;
  }
}

export function downloadDocumentEditorMarkdown() {
  const editor = state.documentEditor;

  if (!editor) {
    return false;
  }

  const blob = new Blob([serializeDocumentAsMarkdown(editor)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${buildDocumentFilename(editor.title)}.md`;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);

  showSuccess(`${editor.title || "Document"} downloaded.`);
  return true;
}

export function syncDocumentEditorAfterRender() {
  const editor = state.documentEditor;
  const documentId = state.selectedDocumentId;

  if (!editor || !documentId || state.documentEditId !== documentId || editor.id !== documentId) {
    tearDownRuntime();
    return;
  }

  ensureEventStream(editor.id);
  syncDocumentEditorSurface();
}

function ensureEventStream(documentId) {
  if (runtime.streamDocumentId === documentId && runtime.eventSource) {
    return;
  }

  tearDownRuntime({ preserveState: true });

  const identity = getCollaborationIdentity();
  const params = new URLSearchParams({
    clientId: identity.clientId,
    mode: "editing",
    name: identity.name,
  });

  runtime.streamDocumentId = documentId;
  runtime.eventSource = createApiEventSource(
    `/api/documents/${documentId}/collaboration/stream?${params.toString()}`,
  );

  runtime.eventSource.addEventListener("open", () => {
    if (!state.documentEditor || state.documentEditor.id !== documentId) {
      return;
    }

    state.documentEditor.connectionState = "live";
    syncDocumentEditorSurface();
    void sendPresence();
  });

  runtime.eventSource.addEventListener("error", () => {
    if (!state.documentEditor || state.documentEditor.id !== documentId) {
      return;
    }

    state.documentEditor.connectionState = "reconnecting";
    syncDocumentEditorSurface();
  });

  for (const eventName of ["sync", "draft", "presence", "saved"]) {
    runtime.eventSource.addEventListener(eventName, (event) => {
      handleCollaborationEvent(eventName, event);
    });
  }

  runtime.presenceTimer = window.setInterval(() => {
    void sendPresence();
  }, PRESENCE_HEARTBEAT_MS);
}

function handleCollaborationEvent(eventName, event) {
  const editor = state.documentEditor;

  if (!editor || !(event instanceof MessageEvent)) {
    return;
  }

  let payload = null;

  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  if (Array.isArray(payload?.participants)) {
    editor.collaborators = payload.participants;
  }

  if (eventName === "presence") {
    syncDocumentEditorSurface();
    return;
  }

  const draft = payload?.draft;

  if (!draft || typeof draft !== "object") {
    syncDocumentEditorSurface();
    return;
  }

  const identity = getCollaborationIdentity();

  if (draft.actorClientId === identity.clientId) {
    if (eventName === "saved") {
      editor.connectionState = "live";
    }

    syncDocumentEditorSurface();
    return;
  }

  editor.pendingRemoteDraft = {
    ...draft,
    sourceEvent: eventName,
  };

  const quietForMs = Date.now() - editor.lastLocalEditAt;

  if (editor.dirty && quietForMs < REMOTE_APPLY_DELAY_MS) {
    const actorName = getParticipantName(draft.actorClientId, editor.collaborators);
    editor.remoteNotice = `${actorName} is updating the shared draft.`;
    clearTimeout(runtime.pendingRemoteTimer);
    runtime.pendingRemoteTimer = window.setTimeout(() => {
      applyPendingRemoteDraft();
    }, REMOTE_APPLY_DELAY_MS);
    syncDocumentEditorSurface();
    return;
  }

  applyPendingRemoteDraft();
}

function applyPendingRemoteDraft() {
  const editor = state.documentEditor;
  const pending = editor?.pendingRemoteDraft;

  if (!editor || !pending) {
    return;
  }

  editor.dirty = false;
  editor.horizonId = pending.horizonId ?? null;
  editor.markdown = pending.markdown;
  editor.pendingRemoteDraft = null;
  editor.remoteNotice = `${getParticipantName(pending.actorClientId, editor.collaborators)} updated the live draft.`;
  editor.saveError = "";
  editor.saveState = pending.sourceEvent === "saved" ? "saved" : "live";
  editor.summary = pending.summary;
  editor.title = pending.title;
  editor.type = pending.type;

  if (pending.sourceEvent === "saved") {
    editor.initialUpdatedAt = pending.updatedAt;
    editor.lastSavedAt = pending.updatedAt;
  }

  const existingDetail = state.documentDetailsById.get(editor.id);

  if (existingDetail) {
    state.documentDetailsById.set(editor.id, {
      ...existingDetail,
      horizonId: pending.horizonId ?? null,
      markdown: pending.markdown,
      summary: pending.summary,
      title: pending.title,
      type: pending.type,
      updatedAt: pending.updatedAt,
    });
  }

  syncDocumentSummary({
    ...(existingDetail ?? {}),
    ...pending,
    horizonName: resolveHorizonName(editor.id, pending.horizonId),
    id: editor.id,
  });
  syncDocumentEditorSurface();
}

async function sendPresence() {
  const editor = state.documentEditor;

  if (!editor) {
    return;
  }

  const identity = getCollaborationIdentity();

  try {
    await apiFetch(`/api/documents/${editor.id}/collaboration/presence`, {
      body: JSON.stringify({
        clientId: identity.clientId,
        mode: "editing",
        name: identity.name,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    // Ignore transient presence updates.
  }
}

function scheduleDraftSync() {
  clearTimeout(runtime.draftTimer);
  runtime.draftTimer = window.setTimeout(() => {
    void sendDraft();
  }, DRAFT_SYNC_DEBOUNCE_MS);
}

async function sendDraft() {
  const editor = state.documentEditor;

  if (!editor) {
    return;
  }

  const identity = getCollaborationIdentity();

  try {
    await apiFetch(`/api/documents/${editor.id}/collaboration/draft`, {
      body: JSON.stringify({
        clientId: identity.clientId,
        horizonId: editor.horizonId,
        markdown: editor.markdown,
        mode: "editing",
        name: identity.name,
        summary: editor.summary,
        title: editor.title,
        type: editor.type,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    if (state.documentEditor) {
      state.documentEditor.connectionState = "offline";
      syncDocumentEditorSurface();
    }
  }
}

function scheduleSave() {
  clearTimeout(runtime.saveTimer);
  runtime.saveTimer = window.setTimeout(() => {
    void saveDocumentEditor();
  }, SAVE_DEBOUNCE_MS);
}

function syncDocumentEditorSurface() {
  const editor = state.documentEditor;

  if (!editor) {
    return;
  }

  syncFieldValue("title", editor.title);
  syncFieldValue("summary", editor.summary);
  syncFieldValue("markdown", editor.markdown);
  syncFieldValue("type", editor.type);
  syncFieldValue("horizonId", editor.horizonId ?? "");

  const preview = document.querySelector("[data-document-editor-preview]");

  if (preview instanceof HTMLElement) {
    preview.innerHTML =
      editor.markdown.trim().length > 0
        ? renderMarkdown(editor.markdown)
        : `<div class="empty-state-inline"><strong>Preview is ready</strong><p>Start writing to see the rendered document.</p></div>`;
  }

  const stats = document.querySelector("[data-document-editor-stats]");

  if (stats instanceof HTMLElement) {
    stats.textContent = buildEditorStats(editor.markdown);
  }

  const status = document.querySelector("[data-document-editor-status]");

  if (status instanceof HTMLElement) {
    status.textContent = buildEditorStatus(editor);
    status.className = `editor-status editor-status-${editor.saveState}`;
  }

  for (const presence of document.querySelectorAll("[data-document-editor-collaborators]")) {
    if (presence instanceof HTMLElement) {
      presence.innerHTML = renderCollaboratorPills(editor.collaborators);
    }
  }

  for (const button of document.querySelectorAll("[data-action='copy-document-content']")) {
    if (button instanceof HTMLElement) {
      const copied = editor.copyState === "copied";

      button.classList.toggle("is-copied", copied);
      button.setAttribute("aria-label", copied ? "Document copied" : "Copy document content");
      button.setAttribute("title", copied ? "Document copied" : "Copy document content");
    }
  }

  const nextNote = editor.saveError || editor.remoteNotice || defaultConnectionMessage(editor);

  for (const note of document.querySelectorAll("[data-document-editor-note]")) {
    if (note instanceof HTMLElement) {
      note.textContent = nextNote;
      note.hidden = !nextNote;
    }
  }

  const writePane = document.querySelector("[data-document-editor-pane='write']");
  const previewPane = document.querySelector("[data-document-editor-pane='preview']");

  if (writePane instanceof HTMLElement) {
    writePane.hidden = editor.view === "preview";
  }

  if (previewPane instanceof HTMLElement) {
    previewPane.hidden = editor.view === "write";
  }

  for (const button of document.querySelectorAll("[data-document-view]")) {
    if (!(button instanceof HTMLElement)) {
      continue;
    }

    button.classList.toggle("is-active", button.getAttribute("data-document-view") === editor.view);
  }
}

function syncFieldValue(field, value) {
  const element = document.querySelector(`[data-editor-field="${field}"]`);

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      return;
    }

    if (document.activeElement !== element && element.value !== String(value ?? "")) {
      element.value = String(value ?? "");
    }
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    if (document.activeElement !== element && element.value !== String(value ?? "")) {
      element.value = String(value ?? "");
    }
  }
}

function syncDocumentSummary(detail) {
  if (!state.snapshot || !detail?.id) {
    return;
  }

  const applyDocumentSummary = (entry) => {
    if (!entry || entry.id !== detail.id) {
      return;
    }

    if ("horizonName" in entry) {
      entry.horizonName = detail.horizonName ?? null;
    }

    if ("spaceId" in entry) {
      entry.spaceId = detail.spaceId ?? entry.spaceId ?? null;
    }

    if ("spaceName" in entry && "spaceName" in detail) {
      entry.spaceName = detail.spaceName ?? null;
    }

    entry.summary = detail.summary;
    entry.title = detail.title;
    entry.type = detail.type;
  };

  const summary = state.snapshot.documents.find((entry) => entry.id === detail.id);

  if (summary) {
    applyDocumentSummary(summary);
  }

  const allDocumentsSummary = state.allDocuments.find((entry) => entry.id === detail.id);

  if (allDocumentsSummary) {
    applyDocumentSummary(allDocumentsSummary);
  }

  for (const workItem of state.snapshot.workItems ?? []) {
    for (const linkedDocument of workItem.linkedDocuments ?? []) {
      applyDocumentSummary(linkedDocument);
    }
  }

  for (const lane of state.snapshot.plan?.computed ?? []) {
    for (const cell of lane.cells ?? []) {
      for (const document of cell.documents ?? []) {
        applyDocumentSummary(document);
      }
    }
  }
}

function tearDownRuntime(options = {}) {
  clearTimeout(runtime.copyTimer);
  clearTimeout(runtime.draftTimer);
  clearTimeout(runtime.pendingRemoteTimer);
  clearTimeout(runtime.saveTimer);
  clearInterval(runtime.presenceTimer);

  runtime.copyTimer = 0;
  runtime.draftTimer = 0;
  runtime.pendingRemoteTimer = 0;
  runtime.presenceTimer = 0;
  runtime.saveTimer = 0;

  if (runtime.eventSource) {
    runtime.eventSource.close();
    runtime.eventSource = null;
  }

  runtime.streamDocumentId = "";

  if (!options.preserveState) {
    state.documentEditor = null;
  }
}

function buildEditorStatus(editor) {
  if (editor.saveState === "saving") {
    return "Saving";
  }

  if (editor.saveState === "error") {
    return "Save failed";
  }

  if (editor.saveState === "dirty") {
    return "Unsaved changes";
  }

  if (editor.saveState === "live") {
    return "Live draft updated";
  }

  return editor.lastSavedAt ? `Saved ${formatDateTime(editor.lastSavedAt)}` : "Saved";
}

function buildEditorStats(markdown) {
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const characters = markdown.length;
  return `${words} words · ${characters} characters`;
}

function renderCollaboratorPills(collaborators) {
  const identity = getCollaborationIdentity();
  return Array.isArray(collaborators) && collaborators.length > 0
    ? collaborators
        .map((collaborator) => {
          const label = collaborator.clientId === identity.clientId ? "You" : collaborator.name;
          const mode =
            collaborator.clientId === identity.clientId
              ? "Editing"
              : collaborator.mode === "viewing"
                ? "Viewing"
                : "Editing";

          return `
              <span class="collaborator-pill"${renderStyleAttribute({ "--collaborator-color": collaborator.color ?? "var(--accent)" })}>
                <span class="collaborator-dot"></span>
                <span>${escapeHtml(label)}</span>
                <span class="collaborator-mode">${escapeHtml(mode)}</span>
              </span>
            `;
        })
        .join("")
    : `
        <span class="collaborator-pill">
          <span class="collaborator-dot"></span>
          <span>You</span>
          <span class="collaborator-mode">Editing</span>
        </span>
      `;
}

function defaultConnectionMessage(editor) {
  if (editor.connectionState === "live") {
    return "";
  }

  if (editor.connectionState === "reconnecting") {
    return "Reconnecting live collaboration…";
  }

  if (editor.connectionState === "offline") {
    return "Working locally until collaboration reconnects.";
  }

  return "Connecting live collaboration…";
}

function getCollaborationIdentity() {
  try {
    const raw = localStorage.getItem(COLLABORATION_IDENTITY_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (typeof parsed?.clientId === "string" && typeof parsed?.name === "string") {
        return parsed;
      }
    }
  } catch {
    // Ignore malformed identity payloads.
  }

  const identity = {
    clientId: generateId(),
    name: `Editor ${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
  };

  try {
    localStorage.setItem(COLLABORATION_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Ignore storage failures.
  }

  return identity;
}

function getParticipantName(clientId, collaborators) {
  return collaborators.find((entry) => entry.clientId === clientId)?.name ?? "A collaborator";
}

function setDocumentEditorCopyState(copyState) {
  const editor = state.documentEditor;

  if (!editor) {
    return;
  }

  editor.copyState = copyState;
  clearTimeout(runtime.copyTimer);

  if (copyState === "copied") {
    runtime.copyTimer = window.setTimeout(() => {
      if (!state.documentEditor || state.documentEditor.id !== editor.id) {
        return;
      }

      state.documentEditor.copyState = "idle";
      syncDocumentEditorSurface();
    }, 1800);
  }

  syncDocumentEditorSurface();
}

function serializeDocumentAsMarkdown(editor) {
  const title = String(editor.title ?? "").trim();
  const summary = String(editor.summary ?? "").trim();
  const markdown = String(editor.markdown ?? "").trim();
  const sections = [];

  if (title) {
    sections.push(`# ${title}`);
  }

  if (summary) {
    sections.push(summary);
  }

  if (markdown) {
    sections.push(markdown);
  }

  return sections.join("\n\n").trimEnd();
}

function buildDocumentFilename(title) {
  const slug = String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "document";
}

function resolveHorizonName(documentId, horizonId) {
  const detail = state.documentDetailsById.get(documentId);

  if (detail?.horizonId === horizonId && detail.horizonName) {
    return detail.horizonName;
  }

  return state.snapshot?.horizons.find((horizon) => horizon.id === horizonId)?.name ?? null;
}

function getShortcutTransform(shortcut, selected) {
  switch (shortcut) {
    case "bold":
      return wrapSelection("**", selected);
    case "italic":
      return wrapSelection("*", selected);
    case "code":
      return wrapSelection("`", selected);
    case "link":
      return {
        selectionEndOffset: "[title](https://example.com)".length,
        selectionStartOffset: 1,
        text: selected ? `[${selected}](https://example.com)` : "[title](https://example.com)",
      };
    case "heading":
      return prefixSelection("# ", selected || "Heading");
    case "bullet":
      return prefixSelection("- ", selected || "List item");
    case "checklist":
      return prefixSelection("- [ ] ", selected || "Checklist item");
    case "quote":
      return prefixSelection("> ", selected || "Quoted note");
    default:
      return null;
  }
}

function getShortcutFromKeyboardEvent(event) {
  if (event.code === "KeyB") {
    return "bold";
  }

  if (event.code === "KeyI") {
    return "italic";
  }

  if (event.code === "KeyK") {
    return "link";
  }

  return null;
}

function wrapSelection(wrapper, selected) {
  const content = selected || "text";

  return {
    selectionEndOffset: wrapper.length + content.length,
    selectionStartOffset: wrapper.length,
    text: `${wrapper}${content}${wrapper}`,
  };
}

function prefixSelection(prefix, selected) {
  const content = selected || "text";

  return {
    selectionEndOffset: prefix.length + content.length,
    selectionStartOffset: prefix.length,
    text: `${prefix}${content}`,
  };
}

async function readResponseError(response, fallback) {
  try {
    const payload = await response.json();

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore malformed error payloads.
  }

  return fallback;
}
