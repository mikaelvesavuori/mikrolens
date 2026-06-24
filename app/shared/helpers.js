import { state } from "../state/state.js";
import {
  getPrimaryEvolutionDocument as resolvePrimaryEvolutionDocument,
  getWorkItemsGroupedByEvolution as resolveWorkItemsGroupedByEvolution,
} from "../work/evolutionGrouping.js";

const accessLevelRanks = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

const builtInHorizonOrder = new Map([
  ["horizon_1", 0],
  ["horizon_2", 1],
  ["horizon_3", 2],
  ["Now", 0],
  ["Next", 1],
  ["Later", 2],
]);

export function normalizeSelection() {
  if (!state.snapshot) {
    return;
  }

  if (!state.snapshot.views.some((view) => view.id === state.activeViewId)) {
    state.activeViewId = "";
  }

  if (
    state.selectedSignalId &&
    !state.snapshot.signals.some((signal) => signal.id === state.selectedSignalId)
  ) {
    state.selectedSignalId = "";
    state.selectedSignalRouteKey = "";
  }

  if (
    state.selectedWorkItemId &&
    !state.snapshot.workItems.some((workItem) => workItem.id === state.selectedWorkItemId)
  ) {
    state.selectedWorkItemId = "";
    state.selectedWorkItemRouteKey = "";
  }

  if (
    state.selectedDocumentId &&
    !state.snapshot.documents.some((document) => document.id === state.selectedDocumentId) &&
    !state.allDocuments.some((document) => document.id === state.selectedDocumentId) &&
    !state.documentDetailsById.has(state.selectedDocumentId)
  ) {
    state.selectedDocumentId = "";
    state.documentEditId = "";
  }
}

export function applyViewFilters(items, filters) {
  return items.filter((item) => {
    if (filters.state && item.state !== filters.state) {
      return false;
    }

    if (filters.type && item.type !== filters.type) {
      return false;
    }

    if (filters.horizonName && item.horizon.name !== filters.horizonName) {
      return false;
    }

    if (filters.blocked && !item.isBlocked) {
      return false;
    }

    if (filters.stale && !item.isStale) {
      return false;
    }

    if (filters.onlyRoadmap && !item.roadmapRelevance) {
      return false;
    }

    return true;
  });
}

export function getActiveView() {
  return getActiveViewFromId(state.activeViewId);
}

export function getActiveViewFromId(viewId) {
  return state.snapshot?.views.find((view) => view.id === viewId) ?? null;
}

export function canCurrentUserEditDocuments() {
  return hasCurrentUserDocumentAccess("editor");
}

export function getUserDisplayName(user, fallbackEmail = "") {
  if (typeof user?.name === "string" && user.name.trim().length > 0) {
    return user.name.trim();
  }

  const localPart = String(user?.email ?? fallbackEmail ?? "")
    .trim()
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  if (!localPart) {
    return "Unknown user";
  }

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function canCurrentUserLinkDocuments(spaceId) {
  return hasCurrentUserDocumentAccess("viewer") && hasCurrentUserBoardAccess(spaceId, "editor");
}

export function hasOpenModal() {
  return Boolean(
    state.captureModalOpen ||
      state.selectedDocumentId ||
      state.selectedSignalId ||
      state.selectedWorkItemId ||
      state.settingsModal,
  );
}

export function getVisibleDocuments() {
  let documents = [...state.snapshot.documents];
  const activeView = getActiveView();

  if (activeView && (activeView.scope === "Direct" || activeView.scope === "Plan")) {
    documents = documents.filter((document) => {
      if (
        activeView.filters.horizonName &&
        document.horizonName !== activeView.filters.horizonName
      ) {
        return false;
      }

      return true;
    });
  }

  if (state.directType) {
    documents = documents.filter((document) => document.type === state.directType);
  }

  if (state.directSearch.trim()) {
    const needle = state.directSearch.trim().toLowerCase();
    documents = documents.filter((document) => {
      const haystack = [
        document.title,
        document.summary,
        document.type,
        document.spaceName ?? "",
        document.horizonName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }

  return documents.sort((left, right) => left.title.localeCompare(right.title));
}

export function getDocumentSpaceLabels(document, workItems = state.snapshot?.workItems ?? []) {
  const linkedSpaces = new Map();

  for (const workItem of workItems) {
    if (
      !(workItem.linkedDocuments ?? []).some((linkedDocument) => linkedDocument.id === document.id)
    ) {
      continue;
    }

    const spaceId = workItem.space?.id ?? workItem.spaceId ?? workItem.spaceName ?? "";
    const spaceName = workItem.space?.name ?? workItem.spaceName ?? "";

    if (!spaceId || !spaceName) {
      continue;
    }

    linkedSpaces.set(spaceId, spaceName);
  }

  if (linkedSpaces.size > 0) {
    return [...linkedSpaces.values()].sort((left, right) => left.localeCompare(right));
  }

  if (document.spaceName?.trim()) {
    return [document.spaceName.trim()];
  }

  return ["Standalone"];
}

export function getVisibleWorkItems() {
  let items = [...state.snapshot.workItems].filter((item) => item.state !== "Archived");
  const activeView = getActiveView();

  if (activeView && activeView.scope === "Work") {
    items = applyViewFilters(items, activeView.filters);
  }

  if (state.search.trim()) {
    const needle = state.search.trim().toLowerCase();
    items = items.filter((item) => {
      const haystack = [
        item.ref,
        item.title,
        item.summary,
        item.space.name,
        item.ownerName ?? "",
        item.linkedDocuments.map((document) => document.title).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }

  return items;
}

export function getVisibleSignals() {
  let items = [...state.snapshot.signals].filter((item) => item.status === "Open");

  if (state.search.trim()) {
    const needle = state.search.trim().toLowerCase();
    items = items.filter((item) => {
      const haystack = [item.ref, item.title, item.summary].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }

  return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getPrimaryEvolutionDocument(workItem) {
  return resolvePrimaryEvolutionDocument(workItem);
}

export function getWorkItemsGroupedByEvolution(items) {
  return resolveWorkItemsGroupedByEvolution(items, getSortedWorkItems);
}

export function getSortedWorkItems(items) {
  const sorted = [...items];
  const workflowOrder = new Map(
    state.snapshot.meta.workflowStates.map((entry, index) => [entry, index]),
  );

  switch (state.workSort) {
    case "id":
      return sorted.sort((left, right) => {
        return (
          left.ref.localeCompare(right.ref, undefined, { numeric: true }) ||
          left.title.localeCompare(right.title)
        );
      });
    case "space":
      return sorted.sort((left, right) => {
        return (
          left.space.name.localeCompare(right.space.name) ||
          compareHorizons(left.horizon, right.horizon) ||
          left.title.localeCompare(right.title)
        );
      });
    case "state":
      return sorted.sort((left, right) => {
        return (
          (workflowOrder.get(left.state) ?? 99) - (workflowOrder.get(right.state) ?? 99) ||
          left.space.name.localeCompare(right.space.name) ||
          left.title.localeCompare(right.title)
        );
      });
    case "horizon":
      return sorted.sort((left, right) => {
        return (
          compareHorizons(left.horizon, right.horizon) ||
          left.space.name.localeCompare(right.space.name) ||
          left.title.localeCompare(right.title)
        );
      });
    case "title":
      return sorted.sort((left, right) => left.title.localeCompare(right.title));
    default:
      return sorted.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

export function getHorizonLabel(horizon) {
  return horizon?.label ?? horizon?.name ?? "";
}

export function getHorizonTimeframe(horizon) {
  return horizon?.timeframeText ?? "";
}

export function getHorizonDefaultByKey(key, defaults = state.snapshot?.horizonDefaults ?? []) {
  return defaults.find((entry) => entry.key === key) ?? null;
}

export function horizonDiffersFromDefault(
  horizon,
  defaults = state.snapshot?.horizonDefaults ?? [],
) {
  if (!horizon) {
    return false;
  }

  const defaultHorizon = getHorizonDefaultByKey(horizon.key, defaults);

  if (!defaultHorizon) {
    return !horizon.inheritsDefault;
  }

  return (
    normalizeHorizonText(getHorizonLabel(horizon)) !== normalizeHorizonText(defaultHorizon.label) ||
    normalizeHorizonText(horizon.description) !==
      normalizeHorizonText(defaultHorizon.description) ||
    normalizeHorizonText(getHorizonTimeframe(horizon)) !==
      normalizeHorizonText(defaultHorizon.timeframeText)
  );
}

export function getSortedSpaceHorizons(spaceId, horizons = state.snapshot?.horizons ?? []) {
  return [...horizons].filter((horizon) => horizon.spaceId === spaceId).sort(compareHorizons);
}

export function formatHorizonKey(key) {
  if (typeof key !== "string" || !key.trim()) {
    return "";
  }

  const match = key.match(/^horizon_(\d+)$/);

  if (match) {
    return `Horizon ${match[1]}`;
  }

  return key.replaceAll(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeHorizonText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function hasCurrentUserDocumentAccess(requiredLevel) {
  if (!state.auth.requiresAuthentication || (state.snapshot?.users.length ?? 0) === 0) {
    return true;
  }

  const currentUser = state.snapshot?.users.find((user) => user.id === state.auth.currentUserId);

  if (!currentUser) {
    return false;
  }

  if (currentUser.role === "Admin") {
    return true;
  }

  return hasAccessLevel(currentUser.permissions?.documents, requiredLevel);
}

function hasCurrentUserBoardAccess(spaceId, requiredLevel) {
  if (!spaceId) {
    return false;
  }

  if (!state.auth.requiresAuthentication || (state.snapshot?.users.length ?? 0) === 0) {
    return true;
  }

  const currentUser = state.snapshot?.users.find((user) => user.id === state.auth.currentUserId);

  if (!currentUser) {
    return false;
  }

  if (currentUser.role === "Admin") {
    return true;
  }

  const boardAccess = currentUser.permissions?.boards;

  if (!boardAccess) {
    return false;
  }

  if (boardAccess.scope === "all") {
    return hasAccessLevel(boardAccess.level, requiredLevel);
  }

  return hasAccessLevel(
    boardAccess.grants.find((grant) => grant.boardId === spaceId)?.level ?? null,
    requiredLevel,
  );
}

function hasAccessLevel(grantedLevel, requiredLevel) {
  if (!grantedLevel) {
    return false;
  }

  return accessLevelRanks[grantedLevel] >= accessLevelRanks[requiredLevel];
}

function compareHorizons(left, right) {
  return (
    getHorizonOrderIndex(left) - getHorizonOrderIndex(right) ||
    getHorizonLabel(left).localeCompare(getHorizonLabel(right))
  );
}

function getHorizonOrderIndex(horizon) {
  if (typeof horizon?.orderIndex === "number") {
    return horizon.orderIndex;
  }

  const snapshotOrder = getSnapshotHorizonOrder(horizon?.key ?? horizon?.label ?? horizon?.name);

  if (typeof snapshotOrder === "number") {
    return snapshotOrder;
  }

  return (
    builtInHorizonOrder.get(horizon?.key ?? "") ??
    builtInHorizonOrder.get(horizon?.label ?? "") ??
    builtInHorizonOrder.get(horizon?.name ?? "") ??
    99
  );
}

function getSnapshotHorizonOrder(value) {
  if (!value || !state.snapshot) {
    return undefined;
  }

  for (const horizonDefault of state.snapshot.horizonDefaults ?? []) {
    if (horizonDefault.key === value || horizonDefault.label === value) {
      return horizonDefault.orderIndex;
    }
  }

  for (const horizon of state.snapshot.horizons ?? []) {
    if (horizon.key === value || horizon.label === value || horizon.name === value) {
      return horizon.orderIndex;
    }
  }

  return undefined;
}

export async function readErrorMessage(response, fallback) {
  try {
    const payload = await response.json();

    if (payload && typeof payload.error === "string" && payload.error) {
      return payload.error;
    }
  } catch {
    // Ignore malformed error payloads.
  }

  return fallback;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatCalendarDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function getIndefiniteArticle(value) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

export function renderMarkdown(markdown) {
  const lines = markdown.replaceAll("\r", "").split("\n");
  const chunks = [];
  let paragraph = [];
  let listItems = [];
  let orderedItems = [];
  let codeBlock = [];
  let inCodeBlock = false;

  const flushCodeBlock = () => {
    if (codeBlock.length === 0) {
      return;
    }

    chunks.push(`<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>`);
    codeBlock = [];
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    chunks.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    chunks.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  };

  const flushOrderedList = () => {
    if (orderedItems.length === 0) {
      return;
    }

    chunks.push(`<ol>${orderedItems.join("")}</ol>`);
    orderedItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      flushOrderedList();

      if (inCodeBlock) {
        flushCodeBlock();
      }

      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeBlock.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushOrderedList();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      chunks.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      chunks.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      chunks.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      chunks.push("<hr />");
      continue;
    }

    if (/^- \[( |x)\] /i.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      const checked = trimmed[3].toLowerCase() === "x";
      const content = formatInline(trimmed.slice(6));
      listItems.push(
        `<li class="markdown-checklist-item"><input type="checkbox" disabled ${
          checked ? "checked" : ""
        } /><span>${content}</span></li>`,
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      flushOrderedList();
      listItems.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      flushList();
      orderedItems.push(`<li>${formatInline(trimmed.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      chunks.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  if (inCodeBlock) {
    flushCodeBlock();
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  return chunks.join("");
}

function formatInline(text) {
  const escaped = escapeHtml(text);

  return escaped
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
