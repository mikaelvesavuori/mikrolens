import { escapeHtml, formatDateTime } from "../shared/helpers.js";

export function renderIcon(name, className = "icon") {
  return `
    <svg class="${escapeHtml(className)}" aria-hidden="true" focusable="false">
      <use href="#icon-${escapeHtml(name)}"></use>
    </svg>
  `;
}

export function renderStyleAttribute(styles) {
  const declarations = Object.entries(styles)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([property, value]) => `${escapeHtml(property)}: ${escapeHtml(value)}`)
    .join("; ");

  return declarations ? ` style="${declarations}"` : "";
}

function renderEmptyStateGraphic() {
  return `
    <div class="empty-state-graphic" aria-hidden="true">
      <span class="empty-state-lens"></span>
      <span class="empty-state-lens-core"></span>
      <span class="empty-state-lens-handle"></span>
    </div>
  `;
}

export function renderRecordTimestampsInline(createdAt, updatedAt) {
  return `
    <dl class="record-timestamps record-timestamps-inline">
      <div class="record-timestamp">
        <dt class="control-label">Created at</dt>
        <dd>${escapeHtml(formatDateTime(createdAt))}</dd>
      </div>
      <div class="record-timestamp">
        <dt class="control-label">Last updated</dt>
        <dd>${escapeHtml(formatDateTime(updatedAt))}</dd>
      </div>
    </dl>
  `;
}

export function renderEmptyStateCard(title, detail) {
  return `
    <div class="empty-state">
      ${renderEmptyStateGraphic()}
      <div class="empty-state-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    </div>
  `;
}

export function renderInlineEmptyState(title, detail) {
  return `
    <div class="empty-state-inline">
      ${renderEmptyStateGraphic()}
      <div class="empty-state-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    </div>
  `;
}

export function renderPageEmptyState(title, detail) {
  return `
    <section class="view-empty-state">
      <div class="empty-state-inline empty-state-page">
        ${renderEmptyStateGraphic()}
        <div class="empty-state-copy">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(detail)}</p>
        </div>
      </div>
    </section>
  `;
}

export function renderLoadingStateCard(title, detail, actionMarkup = "") {
  return `
    <div class="modal-loading">
      ${renderEmptyStateGraphic()}
      <div class="empty-state-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      ${actionMarkup}
    </div>
  `;
}
