import {
  formatDocumentLinkLabel,
  getDocumentLinkCandidates,
  sortLinkedDocuments,
} from "../documents/documentLinkOptions.js";
import {
  canCurrentUserLinkDocuments,
  escapeHtml,
  formatCalendarDate,
  getIndefiniteArticle,
  getPrimaryEvolutionDocument,
  getSortedWorkItems,
  getUserDisplayName,
  getVisibleWorkItems,
  getWorkItemsGroupedByEvolution,
} from "../shared/helpers.js";
import { state } from "../state/state.js";
import {
  renderEmptyStateCard,
  renderPageEmptyState,
  renderRecordTimestampsInline,
  renderStyleAttribute,
} from "./renderShared.js";

export function renderWorkView() {
  const workItems = getVisibleWorkItems();
  const sortedWorkItems = getSortedWorkItems(workItems);
  const groupedWorkItems = getWorkItemsGroupedByEvolution(workItems);
  const parkedCount = state.snapshot.workItems.filter((item) => item.state === "Parked").length;
  const archivedCount = state.snapshot.workItems.filter((item) => item.state === "Archived").length;
  const blockedCount = workItems.filter((item) => item.isBlocked).length;
  const isListView = state.workView !== "board";
  const isWorkflowList = state.workView === "list-workflow";
  const isEvolutionList = state.workView === "list-evolution";

  return `
    <div class="view-stack">
      <section class="work-toolbar">
        <div class="toolbar-block toolbar-block-search">
          <input
            id="work-search"
            class="control search-control"
            placeholder="Search work, spaces..."
            value="${escapeHtml(state.search)}"
          />
          <div class="chip-row">
            <span class="meta-pill">${workItems.length} visible</span>
            <span class="meta-pill">${blockedCount} blocked</span>
            <span class="meta-pill">${parkedCount} parked</span>
            <span class="meta-pill">${archivedCount} archived</span>
          </div>
        </div>
        <div class="toolbar-block toolbar-block-end">
          ${
            isListView
              ? `
                <select id="work-sort" class="control control-inline">
                  <option value="updated-desc" ${state.workSort === "updated-desc" ? "selected" : ""}>Recently updated</option>
                  <option value="id" ${state.workSort === "id" ? "selected" : ""}>ID</option>
                  <option value="space" ${state.workSort === "space" ? "selected" : ""}>Space</option>
                  <option value="state" ${state.workSort === "state" ? "selected" : ""}>State</option>
                  <option value="horizon" ${state.workSort === "horizon" ? "selected" : ""}>Horizon</option>
                  <option value="title" ${state.workSort === "title" ? "selected" : ""}>Title</option>
                </select>
              `
              : ""
          }
          <div class="segmented-control">
            <button type="button" class="segment ${state.workView === "board" ? "is-active" : ""}" data-work-view="board">Board</button>
            <button type="button" class="segment ${isWorkflowList ? "is-active" : ""}" data-work-view="list-workflow">List by Workflow</button>
            <button type="button" class="segment ${isEvolutionList ? "is-active" : ""}" data-work-view="list-evolution">List by Evolution</button>
          </div>
        </div>
      </section>
      ${
        state.workView === "board"
          ? renderBoard(workItems)
          : isEvolutionList
            ? renderEvolutionWorkView(groupedWorkItems)
            : renderDenseList(sortedWorkItems)
      }
    </div>
  `;
}

export function renderWorkItemModal(workItem) {
  const horizons = state.snapshot.horizons.filter(
    (horizon) => horizon.spaceId === workItem.spaceId,
  );
  const availableOwners = [...(state.snapshot.users ?? [])].sort((left, right) =>
    getUserDisplayName(left).localeCompare(getUserDisplayName(right)),
  );
  const canLinkDocuments = canCurrentUserLinkDocuments(workItem.spaceId);
  const linkedDocuments = sortLinkedDocuments(workItem.linkedDocuments);
  const linkedDocumentIds = new Set(workItem.linkedDocuments.map((document) => document.id));
  const availableLinkedDocuments = getDocumentLinkCandidates({
    allDocuments: state.allDocuments,
    linkedDocumentIds,
    visibleDocuments: state.snapshot.documents,
  });
  const showBlockerNote = workItem.state === "Blocked";
  const typeArticle = getIndefiniteArticle(workItem.type);

  return `
    <div class="modal-header">
      <p class="record-lede">
        This is <strong>${escapeHtml(workItem.ref)}</strong>, ${typeArticle} ${escapeHtml(workItem.type)} in
        ${escapeHtml(workItem.space.name)}, scheduled in the ${escapeHtml(workItem.horizon.name)} horizon.
      </p>
      ${renderRecordTimestampsInline(workItem.createdAt, workItem.updatedAt)}
    </div>
    <div class="modal-grid modal-grid-work-item ${state.workItemDocsCollapsed ? "is-sidebar-collapsed" : ""}">
      <form id="work-item-detail-form" data-work-item-id="${escapeHtml(workItem.id)}" class="modal-section">
        <div class="section-title">
          <h4>Details</h4>
          ${renderStateBadge(workItem)}
        </div>
        <label class="form-field">
          <span class="control-label">Title</span>
          <input class="control" name="title" value="${escapeHtml(workItem.title)}" />
        </label>
        <label class="form-field">
          <span class="control-label">Summary</span>
          <textarea class="textarea" name="summary">${escapeHtml(workItem.summary)}</textarea>
        </label>
        <div class="form-row">
          <label class="form-field">
            <span class="control-label">Type</span>
            <select class="control" name="type">
              ${state.snapshot.meta.workItemTypes
                .map(
                  (entry) => `
                    <option value="${escapeHtml(entry)}" ${entry === workItem.type ? "selected" : ""}>
                      ${escapeHtml(entry)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
          <label class="form-field">
            <span class="control-label">State</span>
            <select class="control" name="state">
              ${state.snapshot.meta.workflowStates
                .map(
                  (entry) => `
                    <option value="${escapeHtml(entry)}" ${entry === workItem.state ? "selected" : ""}>
                      ${escapeHtml(entry)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>
        <div class="form-row">
          <label class="form-field">
            <span class="control-label">Horizon</span>
            <select class="control" name="horizonId">
              ${horizons
                .map(
                  (horizon) => `
                    <option value="${escapeHtml(horizon.id)}" ${horizon.id === workItem.horizon.id ? "selected" : ""}>
                      ${escapeHtml(horizon.name)}</option>
                  `,
                )
                .join("")}
            </select>
          </label>
          <label class="form-field">
            <span class="control-label">Target start date</span>
            <input class="control" type="date" name="targetStartDate" value="${escapeHtml(workItem.targetStartDate ?? "")}" />
          </label>
          <label class="form-field">
            <span class="control-label">Target end date</span>
            <input class="control" type="date" name="targetEndDate" value="${escapeHtml(workItem.targetEndDate ?? "")}" />
          </label>
        </div>
        <label class="form-field work-item-owner-field">
          <span class="control-label">Assigned owners</span>
          ${renderWorkItemOwnerField(workItem, availableOwners)}
        </label>
        <div class="form-row">
          <label
            class="form-field"
            data-blocker-row
            ${showBlockerNote ? 'aria-hidden="false"' : 'hidden aria-hidden="true"'}
          >
            <span class="control-label">Blocker note</span>
            <input
              class="control"
              name="blockedReason"
              value="${escapeHtml(workItem.blockedReason)}"
              ${showBlockerNote ? "" : "disabled"}
            />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" data-action="copy-work-item-link">
            Copy link
          </button>
          <button
            type="button"
            class="button button-secondary"
            data-action="copy-work-item-content"
          >
            Copy item
          </button>
          ${
            state.capabilities.canDeleteWorkItems
              ? `
                <button type="button" class="button button-danger" data-action="open-work-item-delete">Remove work item</button>
              `
              : ""
          }
          <button type="submit" class="button button-primary">Save work item</button>
        </div>
      </form>
      <aside class="modal-section modal-sidebar-collapsible ${state.workItemDocsCollapsed ? "is-collapsed" : ""}">
        <button
          type="button"
          class="collapsible-panel-toggle"
          data-action="toggle-work-item-docs"
          aria-expanded="${state.workItemDocsCollapsed ? "false" : "true"}"
        >
          <span class="collapsible-panel-title">${state.workItemDocsCollapsed ? "Docs" : "Linked documents"}</span>
          <span class="collapsible-summary-meta">
            <span class="meta-pill">${workItem.linkedDocuments.length}</span>
            <span class="collapsible-chevron" aria-hidden="true"></span>
          </span>
        </button>
        <div class="modal-sidebar-body">
          ${
            canLinkDocuments
              ? `
                <form
                  class="modal-actions modal-actions-inline work-item-document-link-form"
                  data-form="work-item-document-link"
                  data-work-item-id="${escapeHtml(workItem.id)}"
                >
                  <label class="form-field work-item-document-link-field">
                    <span class="control-label">Link document</span>
                    <select class="control" name="documentId">
                      <option value="">Choose document</option>
                      ${availableLinkedDocuments
                        .map(
                          (document) => `
                            <option value="${escapeHtml(document.id)}">
                              ${escapeHtml(formatDocumentLinkLabel(document))}
                            </option>
                          `,
                        )
                        .join("")}
                    </select>
                  </label>
                  <button
                    type="submit"
                    class="button button-secondary"
                    ${availableLinkedDocuments.length === 0 ? 'disabled title="No documents are available to link."' : ""}
                  >
                    Link document
                  </button>
                </form>
              `
              : `
                <p class="item-copy">Linking needs document access and editor access to this space.</p>
              `
          }
          <div class="collection-list">
            ${
              linkedDocuments.length === 0
                ? `<div class="empty-state">No documents linked yet.</div>`
                : linkedDocuments
                    .map(
                      (document) => `
                        <article class="collection-item work-item-linked-document">
                          <button
                            type="button"
                            class="work-item-linked-document-body"
                            data-select-document="${escapeHtml(document.id)}"
                          >
                            <div class="item-heading">
                              <strong class="item-title">${escapeHtml(document.title)}</strong>
                              <span class="meta-pill">${escapeHtml(document.type)}</span>
                            </div>
                            ${document.summary ? `<p class="item-copy">${escapeHtml(document.summary)}</p>` : ""}
                          </button>
                          ${
                            canLinkDocuments
                              ? `
                                <button
                                  type="button"
                                  class="work-item-linked-document-remove"
                                  data-action="unlink-work-item-document"
                                  data-work-item-id="${escapeHtml(workItem.id)}"
                                  data-document-id="${escapeHtml(document.id)}"
                                  aria-label="Unlink ${escapeHtml(document.title)}"
                                  title="Unlink ${escapeHtml(document.title)}"
                                >
                                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                    <path d="M6.28033 5.21967C5.98744 4.92678 5.51256 4.92678 5.21967 5.21967C4.92678 5.51256 4.92678 5.98744 5.21967 6.28033L8.93934 10L5.21967 13.7197C4.92678 14.0126 4.92678 14.4874 5.21967 14.7803C5.51256 15.0732 5.98744 15.0732 6.28033 14.7803L10 11.0607L13.7197 14.7803C14.0126 15.0732 14.4874 15.0732 14.7803 14.7803C15.0732 14.4874 15.0732 14.0126 14.7803 13.7197L11.0607 10L14.7803 6.28033C15.0732 5.98744 15.0732 5.51256 14.7803 5.21967C14.4874 4.92678 14.0126 4.92678 13.7197 5.21967L10 8.93934L6.28033 5.21967Z" fill="currentColor"/>
                                  </svg>
                                </button>
                              `
                              : ""
                          }
                        </article>
                      `,
                    )
                    .join("")
            }
          </div>
        </div>
      </aside>
    </div>
  `;
}

function renderWorkItemOwnerField(workItem, users) {
  const selectedOwnerIds = new Set((workItem.owners ?? []).map((owner) => owner.id));
  const ownerChips = workItem.owners?.map((owner) => renderWorkItemOwnerChip(owner)).join("") ?? "";
  const ownerOptions = users
    .map((user) => {
      const label = getUserDisplayName(user);
      const optionLabel =
        typeof user.email === "string" && user.email.trim() && user.email !== label
          ? `${label} · ${user.email}`
          : label;

      return `
        <option
          value="${escapeHtml(user.id)}"
          data-owner-label="${escapeHtml(label)}"
          data-owner-meta="${escapeHtml(user.email ?? "")}"
          ${selectedOwnerIds.has(user.id) ? "disabled" : ""}
        >
          ${escapeHtml(optionLabel)}
        </option>
      `;
    })
    .join("");
  const hasAvailableOption = users.some((user) => !selectedOwnerIds.has(user.id));

  return `
    <div class="work-item-owner-selection">
      <div class="work-item-owner-picker">
        <label class="form-field">
          <select class="control" data-owner-select ${users.length === 0 ? "disabled" : ""}>
            <option value="">Choose a user</option>
            ${ownerOptions}
          </select>
        </label>
        <button
          type="button"
          class="button button-secondary"
          data-action="add-work-item-owner"
          ${users.length === 0 || !hasAvailableOption ? "disabled" : ""}
        >
          Add owner
        </button>
      </div>
      <div class="work-item-owner-list" data-owner-list>
        ${ownerChips}
        <p class="item-copy work-item-owner-empty" data-owner-empty ${ownerChips ? "hidden" : ""}>
          No owners linked yet.
        </p>
      </div>
      <div class="work-item-owner-inputs" data-owner-inputs>
        ${(workItem.owners ?? [])
          .map(
            (owner) =>
              `<input type="hidden" name="ownerUserIds" value="${escapeHtml(owner.id)}" data-owner-input="${escapeHtml(owner.id)}" />`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderWorkItemOwnerChip(owner) {
  const label = getUserDisplayName(owner);
  const meta = typeof owner.email === "string" && owner.email.trim() ? owner.email.trim() : "";

  return `
    <span class="work-item-owner-chip" data-owner-chip="${escapeHtml(owner.id)}">
      <span class="work-item-owner-chip-copy">
        <span class="work-item-owner-chip-label">${escapeHtml(label)}</span>
        ${meta ? `<span class="work-item-owner-chip-meta">${escapeHtml(meta)}</span>` : ""}
      </span>
      <button
        type="button"
        class="work-item-owner-chip-remove"
        data-action="remove-work-item-owner"
        data-owner-user-id="${escapeHtml(owner.id)}"
        aria-label="Remove ${escapeHtml(label)}"
      >
        ×
      </button>
    </span>
  `;
}

export function renderLinkedWorkItem(workItem) {
  return `
    <button type="button" class="collection-item" data-select-work-item="${escapeHtml(workItem.id)}">
      <div class="item-heading">
        <strong class="item-title">${escapeHtml(workItem.ref)} · ${escapeHtml(workItem.title)}</strong>
        ${renderStateBadge(workItem)}
      </div>
      <p class="item-copy">${escapeHtml(workItem.summary)}</p>
      <div class="chip-row">
        ${renderWorkMetaBadges(workItem, {
          includeDocs: true,
          includeHorizon: true,
          includeSpace: true,
          includeStale: true,
          includeTarget: true,
        })}
      </div>
    </button>
  `;
}

export function renderWorkItemCollection(items, options = {}) {
  const compact = Boolean(options.compact);

  if (items.length === 0) {
    return `<div class="empty-state">Nothing to show right now.</div>`;
  }

  return items
    .map(
      (item) => `
        <button type="button" class="collection-item ${compact ? "is-compact" : ""}" data-select-work-item="${escapeHtml(item.id)}">
          <div class="item-heading">
            <strong class="item-title">${escapeHtml(item.ref)} · ${escapeHtml(item.title)}</strong>
            ${renderStateBadge(item)}
          </div>
          ${compact ? "" : `<p class="item-copy">${escapeHtml(item.summary)}</p>`}
          <div class="chip-row">
            ${renderWorkMetaBadges(item, {
              includeHorizon: true,
              includeSpace: true,
              includeStale: true,
            })}
          </div>
        </button>
      `,
    )
    .join("");
}

export function renderStateBadge(item) {
  const classes = {
    Active: "status-active",
    Archived: "",
    Blocked: "status-blocked",
    Done: "status-done",
    Inbox: "",
    Parked: "",
    Ready: "status-active",
    Shaping: "",
    Waiting: "status-waiting",
  };

  return `<span class="status-badge ${classes[item.state] ?? ""}">${escapeHtml(item.state)}</span>`;
}

function renderBoard(workItems) {
  const states = state.snapshot.meta.boardWorkflowStates;

  return `
    <section class="board">
      ${states
        .map((workflowState) => {
          const items = workItems.filter((item) => item.state === workflowState);

          return `
            <section
              class="board-column stack-column"
              data-drop-type="state"
              data-drop-state="${escapeHtml(workflowState)}"
            >
              <header class="board-column-header">
                <div>
                  <strong>${escapeHtml(workflowState)}</strong>
                  <p>${items.length} items</p>
                </div>
              </header>
              <div class="board-column-body">
                ${
                  items.length === 0
                    ? renderEmptyStateCard("All clear", "No work is sitting in this column.")
                    : items.map((item) => renderWorkCard(item)).join("")
                }
              </div>
            </section>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderDenseList(workItems) {
  return renderDenseListContent(workItems);
}

function renderDenseListContent(workItems) {
  if (workItems.length === 0) {
    return renderPageEmptyState(
      "No matching work",
      "Try another search or switch back to the board.",
    );
  }

  return `
    <div class="dense-list">
      ${workItems.map((item) => renderDenseRow(item)).join("")}
    </div>
  `;
}

function renderDenseRow(item) {
  return `
    <button
      type="button"
      class="dense-row"
      data-select-work-item="${escapeHtml(item.id)}"
      ${renderStyleAttribute({ "--space-accent": item.space.accent })}
    >
      <div class="dense-row-main">
        <div class="dense-row-title">
          <span class="space-dot"></span>
          <strong>${escapeHtml(item.ref)} · ${escapeHtml(item.title)}</strong>
        </div>
        <p>${escapeHtml(item.summary)}</p>
      </div>
      <div class="dense-row-meta">
        ${renderStateBadge(item)}
        ${renderWorkMetaBadges(item, {
          includeDocs: true,
          includeHorizon: true,
          includeOwner: true,
          includeSpace: true,
          includeStale: true,
          includeTarget: true,
          ownerFallback: "Unassigned",
        })}
      </div>
    </button>
  `;
}

function renderEvolutionWorkView(groups) {
  if (groups.length === 0) {
    return renderDenseList([]);
  }

  return `
    <div class="evolution-work-stack">
      ${groups.map((group) => renderEvolutionWorkGroup(group)).join("")}
    </div>
  `;
}

function getEvolutionSpaceLabels(group) {
  const groupedSpaceNames = [
    ...new Set(group.items.map((item) => item.space.name).filter(Boolean)),
  ];

  if (groupedSpaceNames.length > 0) {
    return groupedSpaceNames;
  }

  if (group.document?.spaceName) {
    return [group.document.spaceName];
  }

  return ["Standalone"];
}

function renderEvolutionWorkGroup(group) {
  const blockedCount = group.items.filter((item) => item.isBlocked).length;
  const staleCount = group.items.filter((item) => item.isStale).length;
  const leadDocument = group.document;
  const evolutionSpaceLabels = getEvolutionSpaceLabels(group);
  const evolutionContext = [evolutionSpaceLabels.join(", "), leadDocument?.horizonName]
    .filter(Boolean)
    .join(" · ");

  return `
    <section class="evolution-work-group">
      ${
        leadDocument
          ? `
            <button
              type="button"
              class="evolution-work-group-header"
              data-select-document="${escapeHtml(leadDocument.id)}"
            >
              <div class="evolution-work-group-copy">
                <strong>${escapeHtml(leadDocument.title)}</strong>
                <p class="evolution-work-group-context">${escapeHtml(evolutionContext)}</p>
                <p>${escapeHtml(leadDocument.summary)}</p>
              </div>
              <div class="evolution-work-group-meta">
                <span class="meta-pill">${group.items.length} work items</span>
                ${blockedCount > 0 ? `<span class="token token-danger">${blockedCount} blocked</span>` : ""}
                ${staleCount > 0 ? `<span class="token token-warn">${staleCount} stale</span>` : ""}
              </div>
            </button>
          `
          : `
            <div class="evolution-work-group-header evolution-work-group-header-static">
              <div class="evolution-work-group-copy">
                <strong>Standalone work</strong>
                <p>Items without a linked Evolution document stay visible here until they link to an Evolution document.</p>
              </div>
              <div class="evolution-work-group-meta">
                <span class="meta-pill">${group.items.length} work items</span>
                ${blockedCount > 0 ? `<span class="token token-danger">${blockedCount} blocked</span>` : ""}
                ${staleCount > 0 ? `<span class="token token-warn">${staleCount} stale</span>` : ""}
              </div>
            </div>
          `
      }
      <div class="evolution-work-group-body">
        ${renderDenseListContent(group.items)}
      </div>
    </section>
  `;
}

function renderWorkCard(item) {
  return `
    <article
      class="work-card"
      draggable="true"
      data-drag-id="${escapeHtml(item.id)}"
      data-drag-kind="work-item"
      data-drag-space-id="${escapeHtml(item.spaceId)}"
      ${renderStyleAttribute({ "--space-accent": item.space.accent })}
    >
      <button type="button" class="record-button" data-select-work-item="${escapeHtml(item.id)}">
        <div class="record-topline">
          <span class="space-dot"></span>
          <span class="meta-pill">${escapeHtml(item.ref)}</span>
          ${renderStateBadge(item)}
        </div>
        <strong class="record-title">${escapeHtml(item.title)}</strong>
        <p class="item-copy">${escapeHtml(item.summary)}</p>
        <div class="chip-row">
          ${renderWorkMetaBadges(item, {
            includeDocs: true,
            includeEvolution: true,
            includeHorizon: true,
            includeOwner: true,
            includeSpace: true,
            includeStale: true,
            includeTarget: true,
            includeType: true,
          })}
        </div>
      </button>
    </article>
  `;
}

function renderTargetDateToken(item) {
  if (!item.targetStartDate && !item.targetEndDate) {
    return "";
  }

  return renderIconBadge({
    icon: "target",
    label: renderTargetWindowLabel(item),
  });
}

const WORK_BADGE_ICONS = {
  docs: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M15.6213 4.37868C14.4497 3.20711 12.5503 3.20711 11.3787 4.37868L4.37868 11.3787C3.20711 12.5503 3.20711 14.4497 4.37868 15.6213C5.54995 16.7926 7.44878 16.7929 8.62042 15.6222C8.62072 15.6219 8.62102 15.6216 8.62132 15.6213L9.11792 15.1214C9.40985 14.8276 9.88472 14.826 10.1786 15.1179C10.4724 15.4098 10.474 15.8847 10.1821 16.1786L9.68373 16.6802L9.68198 16.682C7.92462 18.4393 5.07538 18.4393 3.31802 16.682C1.56066 14.9246 1.56066 12.0754 3.31802 10.318L10.318 3.31802C12.0754 1.56066 14.9246 1.56066 16.682 3.31802C18.438 5.07407 18.4393 7.92038 16.6859 9.67806L13.2312 13.2312C12.2061 14.2564 10.544 14.2563 9.51885 13.2312C8.49372 12.206 8.49372 10.544 9.51885 9.51886L12.9697 6.06804C13.2626 5.77515 13.7374 5.77515 14.0303 6.06804C14.3232 6.36094 14.3232 6.83581 14.0303 7.1287L10.5795 10.5795C10.1402 11.0189 10.1402 11.7312 10.5795 12.1705C11.0178 12.6088 11.7276 12.6099 12.1672 12.1738L15.6213 8.62127C16.7928 7.4497 16.7929 5.55025 15.6213 4.37868Z" fill="currentColor"/>
    </svg>
  `,
  evolution: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 2C3.67157 2 3 2.67157 3 3.5V16.5C3 17.3284 3.67157 18 4.5 18H15.5C16.3284 18 17 17.3284 17 16.5V7.62132C17 7.2235 16.842 6.84197 16.5607 6.56066L12.4393 2.43934C12.158 2.15804 11.7765 2 11.3787 2H4.5ZM6.75 10.5C6.33579 10.5 6 10.8358 6 11.25C6 11.6642 6.33579 12 6.75 12H13.25C13.6642 12 14 11.6642 14 11.25C14 10.8358 13.6642 10.5 13.25 10.5H6.75ZM6.75 13.5C6.33579 13.5 6 13.8358 6 14.25C6 14.6642 6.33579 15 6.75 15H13.25C13.6642 15 14 14.6642 14 14.25C14 13.8358 13.6642 13.5 13.25 13.5H6.75Z" fill="currentColor"/>
    </svg>
  `,
  horizon: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18ZM10.75 5C10.75 4.58579 10.4142 4.25 10 4.25C9.58579 4.25 9.25 4.58579 9.25 5V10C9.25 10.4142 9.58579 10.75 10 10.75H14C14.4142 10.75 14.75 10.4142 14.75 10C14.75 9.58579 14.4142 9.25 14 9.25H10.75V5Z" fill="currentColor"/>
    </svg>
  `,
  owner: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 8C11.6569 8 13 6.65685 13 5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5C7 6.65685 8.34315 8 10 8Z" fill="currentColor"/>
      <path d="M3.46517 14.4935C3.27029 15.0016 3.44435 15.571 3.8742 15.9046C5.56656 17.218 7.69202 18 10.0001 18C12.3106 18 14.438 17.2164 16.1312 15.9006C16.5608 15.5667 16.7345 14.9971 16.5393 14.4892C15.5301 11.8635 12.9842 10 10.0031 10C7.02032 10 4.47329 11.8656 3.46517 14.4935Z" fill="currentColor"/>
    </svg>
  `,
  space: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.75 3C2.7835 3 2 3.7835 2 4.75V8.01091C2.50515 7.6875 3.10568 7.5 3.75 7.5H16.25C16.8943 7.5 17.4949 7.6875 18 8.01091V6.75C18 5.7835 17.2165 5 16.25 5H11.4142C11.3479 5 11.2843 4.97366 11.2374 4.92678L9.82322 3.51256C9.49503 3.18437 9.04992 3 8.58579 3H3.75Z" fill="currentColor"/>
      <path d="M3.75 9C2.7835 9 2 9.7835 2 10.75V15.25C2 16.2165 2.7835 17 3.75 17H16.25C17.2165 17 18 16.2165 18 15.25V10.75C18 9.7835 17.2165 9 16.25 9H3.75Z" fill="currentColor"/>
    </svg>
  `,
  stale: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M8.4845 2.49499C9.15808 1.32833 10.842 1.32833 11.5156 2.495L17.7943 13.37C18.4678 14.5367 17.6259 15.995 16.2787 15.995H3.72136C2.37421 15.995 1.53224 14.5367 2.20582 13.37L8.4845 2.49499ZM10 5C10.4142 5 10.75 5.33579 10.75 5.75V9.25C10.75 9.66421 10.4142 10 10 10C9.58579 10 9.25 9.66421 9.25 9.25L9.25 5.75C9.25 5.33579 9.58579 5 10 5ZM10 14C10.5523 14 11 13.5523 11 13C11 12.4477 10.5523 12 10 12C9.44772 12 9 12.4477 9 13C9 13.5523 9.44772 14 10 14Z" fill="currentColor"/>
    </svg>
  `,
  target: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.25 12C5.25 11.5858 5.58579 11.25 6 11.25H6.01C6.42421 11.25 6.76 11.5858 6.76 12V12.01C6.76 12.4242 6.42421 12.76 6.01 12.76H6C5.58579 12.76 5.25 12.4242 5.25 12.01V12Z" fill="currentColor"/>
      <path d="M6 13.25C5.58579 13.25 5.25 13.5858 5.25 14V14.01C5.25 14.4242 5.58579 14.76 6 14.76H6.01C6.42421 14.76 6.76 14.4242 6.76 14.01V14C6.76 13.5858 6.42421 13.25 6.01 13.25H6Z" fill="currentColor"/>
      <path d="M7.25 12C7.25 11.5858 7.58579 11.25 8 11.25H8.01C8.42421 11.25 8.76 11.5858 8.76 12V12.01C8.76 12.4242 8.42421 12.76 8.01 12.76H8C7.58579 12.76 7.25 12.4242 7.25 12.01V12Z" fill="currentColor"/>
      <path d="M8 13.25C7.58579 13.25 7.25 13.5858 7.25 14V14.01C7.25 14.4242 7.58579 14.76 8 14.76H8.01C8.42421 14.76 8.76 14.4242 8.76 14.01V14C8.76 13.5858 8.42421 13.25 8.01 13.25H8Z" fill="currentColor"/>
      <path d="M9.25 10C9.25 9.58579 9.58579 9.25 10 9.25H10.01C10.4242 9.25 10.76 9.58579 10.76 10V10.01C10.76 10.4242 10.4242 10.76 10.01 10.76H10C9.58579 10.76 9.25 10.4242 9.25 10.01V10Z" fill="currentColor"/>
      <path d="M10 11.25C9.58579 11.25 9.25 11.5858 9.25 12V12.01C9.25 12.4242 9.58579 12.76 10 12.76H10.01C10.4242 12.76 10.76 12.4242 10.76 12.01V12C10.76 11.5858 10.4242 11.25 10.01 11.25H10Z" fill="currentColor"/>
      <path d="M9.25 14C9.25 13.5858 9.58579 13.25 10 13.25H10.01C10.4242 13.25 10.76 13.5858 10.76 14V14.01C10.76 14.4242 10.4242 14.76 10.01 14.76H10C9.58579 14.76 9.25 14.4242 9.25 14.01V14Z" fill="currentColor"/>
      <path d="M12 9.25C11.5858 9.25 11.25 9.58579 11.25 10V10.01C11.25 10.4242 11.5858 10.76 12 10.76H12.01C12.4242 10.76 12.76 10.4242 12.76 10.01V10C12.76 9.58579 12.4242 9.25 12.01 9.25H12Z" fill="currentColor"/>
      <path d="M11.25 12C11.25 11.5858 11.5858 11.25 12 11.25H12.01C12.4242 11.25 12.76 11.5858 12.76 12V12.01C12.76 12.4242 12.4242 12.76 12.01 12.76H12C11.5858 12.76 11.25 12.4242 11.25 12.01V12Z" fill="currentColor"/>
      <path d="M12 13.25C11.5858 13.25 11.25 13.5858 11.25 14V14.01C11.25 14.4242 11.5858 14.76 12 14.76H12.01C12.4242 14.76 12.76 14.4242 12.76 14.01V14C12.76 13.5858 12.4242 13.25 12.01 13.25H12Z" fill="currentColor"/>
      <path d="M13.25 10C13.25 9.58579 13.5858 9.25 14 9.25H14.01C14.4242 9.25 14.76 9.58579 14.76 10V10.01C14.76 10.4242 14.4242 10.76 14.01 10.76H14C13.5858 10.76 13.25 10.4242 13.25 10.01V10Z" fill="currentColor"/>
      <path d="M14 11.25C13.5858 11.25 13.25 11.5858 13.25 12V12.01C13.25 12.4242 13.5858 12.76 14 12.76H14.01C14.4242 12.76 14.76 12.4242 14.76 12.01V12C14.76 11.5858 14.4242 11.25 14.01 11.25H14Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.75 2C6.16421 2 6.5 2.33579 6.5 2.75V4H13.5V2.75C13.5 2.33579 13.8358 2 14.25 2C14.6642 2 15 2.33579 15 2.75V4H15.25C16.7688 4 18 5.23122 18 6.75V15.25C18 16.7688 16.7688 18 15.25 18H4.75C3.23122 18 2 16.7688 2 15.25V6.75C2 5.23122 3.23122 4 4.75 4H5V2.75C5 2.33579 5.33579 2 5.75 2ZM4.75 7.5C4.05964 7.5 3.5 8.05964 3.5 8.75V15.25C3.5 15.9404 4.05964 16.5 4.75 16.5H15.25C15.9404 16.5 16.5 15.9404 16.5 15.25V8.75C16.5 8.05964 15.9404 7.5 15.25 7.5H4.75Z" fill="currentColor"/>
    </svg>
  `,
  type: `
    <svg class="token-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 2C3.11929 2 2 3.11929 2 4.5V8.37868C2 9.04172 2.26339 9.67761 2.73223 10.1464L10.2322 17.6464C11.2085 18.6228 12.7915 18.6228 13.7678 17.6464L17.6464 13.7678C18.6228 12.7915 18.6228 11.2085 17.6464 10.2322L10.1464 2.73223C9.67761 2.26339 9.04172 2 8.37868 2H4.5ZM5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z" fill="currentColor"/>
    </svg>
  `,
};

export function renderIconBadge({ classes = "token", icon, label, title = "", truncate = false }) {
  const text = typeof label === "string" ? label.trim() : "";

  if (!text) {
    return "";
  }

  const safeTitle = title || (truncate ? text : "");

  return `
    <span class="${classes}${truncate ? " token-truncate" : ""}"${safeTitle ? ` title="${escapeHtml(safeTitle)}"` : ""}>
      ${WORK_BADGE_ICONS[icon] ?? ""}
      <span class="token-label">${escapeHtml(text)}</span>
    </span>
  `;
}

function renderWorkMetaBadges(item, options = {}) {
  const {
    includeDocs = false,
    includeEvolution = false,
    includeHorizon = false,
    includeOwner = false,
    includeSpace = false,
    includeStale = false,
    includeTarget = false,
    includeType = false,
    ownerFallback = "",
  } = options;
  const ownerLabel = item.ownerName?.trim() || ownerFallback;
  const primaryEvolution = includeEvolution ? getPrimaryEvolutionDocument(item) : null;

  return [
    includeType ? renderIconBadge({ icon: "type", label: item.type }) : "",
    includeHorizon
      ? renderIconBadge({
          classes: "token token-accent",
          icon: "horizon",
          label: item.horizon.name,
        })
      : "",
    includeSpace ? renderIconBadge({ icon: "space", label: item.space.name }) : "",
    includeOwner && ownerLabel ? renderIconBadge({ icon: "owner", label: ownerLabel }) : "",
    includeTarget ? renderTargetDateToken(item) : "",
    includeEvolution && primaryEvolution
      ? renderIconBadge({
          icon: "evolution",
          label: primaryEvolution.title,
          title: primaryEvolution.title,
          truncate: true,
        })
      : "",
    includeDocs && item.linkedDocuments.length > 0
      ? renderIconBadge({
          icon: "docs",
          label: `${item.linkedDocuments.length} docs`,
        })
      : "",
    includeStale && item.isStale
      ? renderIconBadge({
          classes: "token token-warn",
          icon: "stale",
          label: "Stale",
        })
      : "",
  ]
    .filter(Boolean)
    .join("");
}

function renderTargetWindowLabel(item) {
  if (item.targetStartDate && item.targetEndDate) {
    return `${formatCalendarDate(item.targetStartDate)}-${formatCalendarDate(item.targetEndDate)}`;
  }

  if (item.targetStartDate) {
    return `Start ${formatCalendarDate(item.targetStartDate)}`;
  }

  if (item.targetEndDate) {
    return `Target ${formatCalendarDate(item.targetEndDate)}`;
  }

  return "";
}
