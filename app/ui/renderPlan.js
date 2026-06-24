import { escapeHtml, formatCalendarDate, getPrimaryEvolutionDocument } from "../shared/helpers.js";
import { state } from "../state/state.js";
import { renderInlineEmptyState, renderStyleAttribute } from "./renderShared.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function renderPlanView() {
  const plan = state.snapshot.plan;
  const isTimelineView = state.planDisplay === "timeline";

  return `
    <div class="view-stack">
      <div class="plan-controls">
        ${
          isTimelineView
            ? `
              <div class="plan-controls-group plan-controls-group-leading">
                <div class="segmented-control" aria-label="Timeline order">
                  <button type="button" class="segment ${state.planTimelineSort === "date" ? "is-active" : ""}" data-plan-timeline-sort="date">Dates</button>
                  <button type="button" class="segment ${state.planTimelineSort === "space" ? "is-active" : ""}" data-plan-timeline-sort="space">Spaces</button>
                  <button type="button" class="segment ${state.planTimelineSort === "horizon" ? "is-active" : ""}" data-plan-timeline-sort="horizon">Horizons</button>
                </div>
              </div>
            `
            : ""
        }
        <div class="plan-controls-group plan-controls-group-trailing">
          <div class="segmented-control" aria-label="Plan view">
            <button type="button" class="segment ${state.planDisplay === "board" ? "is-active" : ""}" data-plan-display="board">Board</button>
            <button type="button" class="segment ${state.planDisplay === "list" ? "is-active" : ""}" data-plan-display="list">List</button>
            <button type="button" class="segment ${state.planDisplay === "timeline" ? "is-active" : ""}" data-plan-display="timeline">Timeline</button>
          </div>
        </div>
      </div>
      <div class="plan-content">
        ${
          state.planDisplay === "board"
            ? renderPlanBoard(plan)
            : state.planDisplay === "timeline"
              ? renderPlanTimeline()
              : renderPlanList(plan)
        }
      </div>
    </div>
  `;
}

function renderPlanBoard(plan) {
  return `
    <div class="plan-matrix">
      ${plan.computed
        .map((lane) => {
          const cells = lane.cells;

          return `
            <article class="plan-row">
              <header class="plan-row-heading">
                <div class="plan-row-heading-main">
                  <strong>${escapeHtml(lane.space.name)}</strong>
                  <p>${escapeHtml(lane.space.description)}</p>
                </div>
                <span class="meta-pill plan-row-count">${cells.reduce((count, cell) => count + cell.documents.length, 0)}</span>
              </header>
              <div class="plan-row-cells">
                ${cells
                  .map(
                    (cell) => `
                      <section
                        class="plan-cell board-column stack-column"
                        data-drop-type="horizon"
                        data-drop-horizon-id="${escapeHtml(cell.horizon.id)}"
                        data-drop-space-id="${escapeHtml(lane.space.id)}"
                      >
                        <div class="plan-cell-header board-column-header">
                          <div>
                            <strong>${escapeHtml(cell.horizon.label)}</strong>
                            <p>${cell.documents.length} evolutions</p>
                          </div>
                        </div>
                        <div class="plan-entry-list board-column-body">
                          ${
                            cell.documents.length === 0
                              ? `
                                <div class="plan-cell-empty">
                                  <strong>Nothing here yet</strong>
                                  <p>Add an evolution when this horizon starts to matter.</p>
                                </div>
                              `
                              : ""
                          }
                          ${cell.documents
                            .map(
                              (document) => `
                                <article
                                  class="plan-entry plan-entry-draggable work-card"
                                  draggable="true"
                                  data-drag-id="${escapeHtml(document.id)}"
                                  data-drag-kind="document"
                                  data-drag-space-id="${escapeHtml(document.spaceId)}"
                                >
                                  <button
                                    type="button"
                                    class="plan-entry-button record-button"
                                    data-select-document="${escapeHtml(document.id)}"
                                  >
                                    <strong class="record-title">${escapeHtml(document.title)}</strong>
                                    ${document.summary ? `<p class="item-copy">${escapeHtml(document.summary)}</p>` : ""}
                                  </button>
                                </article>
                              `,
                            )
                            .join("")}
                        </div>
                      </section>
                    `,
                  )
                  .join("")}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPlanList(plan) {
  return `
    <div class="plan-list-stack">
      ${plan.computed
        .map((lane) => {
          const entries = lane.cells.flatMap((cell) =>
            cell.documents.map((document) => ({
              id: document.id,
              kind: "document",
              horizonLabel: cell.horizon.label,
              summary: document.summary,
              title: document.title,
            })),
          );

          return `
            <article class="plan-list-lane">
              <header class="plan-row-heading">
                <div class="plan-row-heading-main">
                  <strong>${escapeHtml(lane.space.name)}</strong>
                  <p>${escapeHtml(lane.space.description)}</p>
                </div>
                <span class="meta-pill plan-row-count">${entries.length}</span>
              </header>
              <div class="dense-list">
                ${
                  entries.length === 0
                    ? renderInlineEmptyState(
                        "No roadmap evolutions yet",
                        "Add an Evolution document in this space when something becomes relevant.",
                      )
                    : entries
                        .map(
                          (entry) => `
                            <button
                              type="button"
                              class="dense-row dense-row-plan"
                              ${entry.kind === "document" ? `data-select-document="${escapeHtml(entry.id)}"` : `data-select-work-item="${escapeHtml(entry.id)}"`}
                            >
                              <div class="dense-row-main">
                                <div class="dense-row-title">
                                  <strong>${escapeHtml(entry.title)}</strong>
                                </div>
                                <p>${escapeHtml(entry.summary)}</p>
                              </div>
                              <div class="dense-row-meta">
                                <span class="token token-accent">${escapeHtml(entry.horizonLabel)}</span>
                              </div>
                            </button>
                          `,
                        )
                        .join("")
                }
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPlanTimeline() {
  const timeline = getPlanTimelineModel();

  if (timeline.scheduledEntries.length === 0 && timeline.undatedEntries.length === 0) {
    return renderInlineEmptyState(
      "No roadmap timeline yet",
      "Add roadmap work with target dates to start shaping the timeline.",
    );
  }

  return `
    <div class="plan-timeline-view">
      <div class="chip-row plan-timeline-summary">
        <span class="meta-pill">${timeline.scheduledEntries.length} scheduled</span>
        <span class="meta-pill">${timeline.undatedEntries.length} without dates</span>
        ${timeline.rangeLabel ? `<span class="meta-pill">${escapeHtml(timeline.rangeLabel)}</span>` : ""}
      </div>
      ${
        timeline.scheduledEntries.length > 0
          ? renderPlanGantt(timeline)
          : renderInlineEmptyState(
              "No scheduled roadmap work yet",
              "Add target dates to place roadmap work on the timeline.",
            )
      }
      ${timeline.undatedEntries.length > 0 ? renderPlanTimelineUndated(timeline.undatedEntries) : ""}
    </div>
  `;
}

function renderPlanGantt(timeline) {
  return `
    <section class="plan-gantt-shell surface surface-compact">
      <div class="plan-gantt-scroll">
        <div class="plan-gantt"${renderStyleAttribute({ "--timeline-columns": timeline.months.length })}>
          <div class="plan-gantt-corner">
            <span>Roadmap items</span>
          </div>
          <div class="plan-gantt-scale" aria-hidden="true">
            ${timeline.months
              .map(
                (month) => `
                  <div class="plan-gantt-scale-cell" data-timeline-month="${escapeHtml(month.key)}">
                    <strong>${escapeHtml(month.monthLabel)}</strong>
                    <span>${escapeHtml(month.yearLabel)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
          ${timeline.scheduledEntries.map((entry) => renderPlanGanttRow(entry, timeline)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPlanGanttRow(entry, timeline) {
  const targetLabel = renderTimelineTargetLabel(entry);
  const metaParts = [entry.spaceLabel];

  if (entry.horizonLabel) {
    metaParts.push(entry.horizonLabel);
  }

  if (targetLabel) {
    metaParts.push(targetLabel);
  }

  return `
    <button
      type="button"
      class="plan-gantt-row"
      data-select-work-item="${escapeHtml(entry.id)}"
    >
      <div class="plan-gantt-row-copy">
        <div class="plan-gantt-row-title">
          <strong>${escapeHtml(entry.title)}</strong>
          <span class="plan-gantt-row-ref">${escapeHtml(entry.kindLabel)}</span>
        </div>
        <div class="plan-gantt-row-meta">
          ${metaParts
            .map(
              (part, index) => `
                ${index > 0 ? `<span class="plan-gantt-row-meta-separator" aria-hidden="true">/</span>` : ""}
                <span>${escapeHtml(part)}</span>
              `,
            )
            .join("")}
        </div>
        ${entry.evolutionTitle ? `<p class="plan-gantt-row-context">${escapeHtml(entry.evolutionTitle)}</p>` : ""}
      </div>
      <div class="plan-gantt-track">
        <div class="plan-gantt-track-grid" aria-hidden="true">
          ${timeline.months.map(() => `<span class="plan-gantt-track-cell"></span>`).join("")}
        </div>
        <span class="plan-gantt-bar"${renderPlanGanttBarStyleAttribute(entry, timeline)}></span>
      </div>
    </button>
  `;
}

function renderPlanGanttBarStyleAttribute(entry, timeline) {
  const timelineStart = parseTimelineDate(entry.timelineStartDate);
  const timelineEnd = parseTimelineDate(entry.timelineEndDate);

  if (!timelineStart || !timelineEnd || !timeline.startBoundary || !timeline.endBoundaryExclusive) {
    return "";
  }

  const leftDays = differenceInUtcDays(timeline.startBoundary, timelineStart);
  const widthDays = differenceInUtcDays(timelineStart, addUtcDays(timelineEnd, 1));
  const left = (leftDays / timeline.totalDays) * 100;
  const width = Math.max((widthDays / timeline.totalDays) * 100, 1.2);

  return renderStyleAttribute({ left: `${left.toFixed(3)}%`, width: `${width.toFixed(3)}%` });
}

function renderPlanTimelineUndated(entries) {
  return `
    <article class="plan-list-lane">
      <header class="plan-row-heading">
        <div class="plan-row-heading-main">
          <strong>No target dates</strong>
          <p>Roadmap work and evolutions that still need explicit scheduling metadata.</p>
        </div>
        <span class="meta-pill plan-row-count">${entries.length}</span>
      </header>
      <div class="dense-list">
        ${entries.map((entry) => renderPlanTimelineEntry(entry)).join("")}
      </div>
    </article>
  `;
}

function getPlanTimelineModel() {
  const roadmapWorkItems = (state.snapshot?.workItems ?? [])
    .filter((item) => item.state !== "Archived" && item.roadmapRelevance)
    .map((item) => {
      const primaryEvolution = getPrimaryEvolutionDocument(item);
      const { timelineEndDate, timelineStartDate } = getTimelineDateRange(item);

      return {
        evolutionId: primaryEvolution?.id ?? "",
        evolutionTitle: primaryEvolution?.title ?? "",
        horizonKey: item.horizon.key,
        horizonLabel: item.horizon.label || item.horizon.name,
        horizonName: item.horizon.name || item.horizon.label,
        horizonOrderIndex: item.horizon.orderIndex ?? getTimelineHorizonOrder(item.horizon.key),
        id: item.id,
        kind: "work-item",
        kindLabel: item.ref,
        spaceLabel: item.space.name,
        summary: item.summary,
        targetEndDate: item.targetEndDate ?? null,
        targetStartDate: item.targetStartDate ?? null,
        timelineEndDate,
        timelineStartDate,
        title: item.title,
      };
    })
    .sort(compareTimelineEntries);
  const representedEvolutionIds = new Set(
    roadmapWorkItems.map((entry) => entry.evolutionId).filter(Boolean),
  );
  const undatedEvolutionEntries = (state.snapshot?.documents ?? [])
    .filter(
      (document) => document.type === "Evolution" && !representedEvolutionIds.has(document.id),
    )
    .map((document) => ({
      evolutionId: "",
      evolutionTitle: "",
      horizonKey: document.horizonKey ?? "",
      horizonLabel: document.horizonName ?? "",
      id: document.id,
      kind: "document",
      kindLabel: document.type,
      spaceLabel: document.spaceName ?? "Standalone",
      horizonName: document.horizonName ?? "",
      horizonOrderIndex: getTimelineHorizonOrder(document.horizonKey ?? document.horizonName ?? ""),
      summary: document.summary,
      targetEndDate: null,
      targetStartDate: null,
      timelineEndDate: null,
      timelineStartDate: null,
      title: document.title,
    }))
    .sort(compareTimelineEntries);
  const scheduledEntries = roadmapWorkItems
    .filter((entry) => entry.timelineStartDate && entry.timelineEndDate)
    .sort(compareTimelineEntries);
  const undatedWorkItems = roadmapWorkItems
    .filter((entry) => !entry.timelineStartDate || !entry.timelineEndDate)
    .sort(compareTimelineEntries);
  const undatedEntries = [...undatedWorkItems, ...undatedEvolutionEntries].sort(
    compareTimelineEntries,
  );

  if (scheduledEntries.length === 0) {
    return {
      endBoundaryExclusive: null,
      months: [],
      rangeLabel: "",
      scheduledEntries,
      startBoundary: null,
      totalDays: 0,
      undatedEntries,
    };
  }

  const startDates = scheduledEntries.map((entry) => parseTimelineDate(entry.timelineStartDate));
  const endDates = scheduledEntries.map((entry) => parseTimelineDate(entry.timelineEndDate));
  const minStart = new Date(Math.min(...startDates.map((date) => date.getTime())));
  const maxEnd = new Date(Math.max(...endDates.map((date) => date.getTime())));
  const startBoundary = getMonthStart(minStart);
  const endBoundaryExclusive = getNextMonthStart(maxEnd);
  const months = buildTimelineMonths(startBoundary, endBoundaryExclusive);

  return {
    endBoundaryExclusive,
    months,
    rangeLabel: formatTimelineRange(months),
    scheduledEntries,
    startBoundary,
    totalDays: differenceInUtcDays(startBoundary, endBoundaryExclusive),
    undatedEntries,
  };
}

function getTimelineDateRange(item) {
  const timelineStartDate = item.targetStartDate ?? item.targetEndDate ?? null;
  const timelineEndDate = item.targetEndDate ?? item.targetStartDate ?? null;

  if (!timelineStartDate || !timelineEndDate) {
    return {
      timelineEndDate: null,
      timelineStartDate: null,
    };
  }

  if (timelineStartDate.localeCompare(timelineEndDate) <= 0) {
    return {
      timelineEndDate,
      timelineStartDate,
    };
  }

  return {
    timelineEndDate: timelineStartDate,
    timelineStartDate: timelineEndDate,
  };
}

function buildTimelineMonths(startBoundary, endBoundaryExclusive) {
  const months = [];
  let cursor = new Date(startBoundary.getTime());

  while (cursor.getTime() < endBoundaryExclusive.getTime()) {
    months.push({
      key: formatMonthKey(cursor),
      label: new Intl.DateTimeFormat(undefined, {
        month: "short",
        year: "numeric",
      }).format(cursor),
      monthLabel: new Intl.DateTimeFormat(undefined, {
        month: "short",
      }).format(cursor),
      yearLabel: new Intl.DateTimeFormat(undefined, {
        year: "numeric",
      }).format(cursor),
    });
    cursor = getNextMonthStart(cursor);
  }

  return months;
}

function formatTimelineRange(months) {
  if (months.length === 0) {
    return "";
  }

  if (months.length === 1) {
    return months[0].label;
  }

  return `${months[0].label} to ${months[months.length - 1].label}`;
}

function parseTimelineDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));

  return new Date(Date.UTC(year, month - 1, day));
}

function getMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getNextMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function differenceInUtcDays(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_IN_MS);
}

function formatMonthKey(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${date.getUTCFullYear()}-${month}`;
}

function renderPlanTimelineEntry(entry) {
  const selectionAttribute =
    entry.kind === "document"
      ? `data-select-document="${escapeHtml(entry.id)}"`
      : `data-select-work-item="${escapeHtml(entry.id)}"`;
  const targetLabel = renderTimelineTargetLabel(entry);

  return `
    <button
      type="button"
      class="dense-row dense-row-plan dense-row-plan-timeline"
      ${selectionAttribute}
    >
      <div class="dense-row-main">
        <div class="dense-row-title">
          <strong>${escapeHtml(entry.title)}</strong>
        </div>
        ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}
      </div>
      <div class="dense-row-meta">
        <span class="meta-pill">${escapeHtml(entry.kindLabel)}</span>
        <span class="token">${escapeHtml(entry.spaceLabel)}</span>
        ${entry.horizonLabel ? `<span class="token token-accent">${escapeHtml(entry.horizonLabel)}</span>` : ""}
        ${targetLabel ? `<span class="token">${escapeHtml(targetLabel)}</span>` : ""}
        ${entry.evolutionTitle ? `<span class="token">${escapeHtml(entry.evolutionTitle)}</span>` : ""}
      </div>
    </button>
  `;
}

function renderTimelineTargetLabel(entry) {
  if (entry.targetStartDate && entry.targetEndDate) {
    return `${formatCalendarDate(entry.targetStartDate)}-${formatCalendarDate(entry.targetEndDate)}`;
  }

  if (entry.targetStartDate) {
    return `Start ${formatCalendarDate(entry.targetStartDate)}`;
  }

  if (entry.targetEndDate) {
    return `Target ${formatCalendarDate(entry.targetEndDate)}`;
  }

  return "";
}

function compareTimelineEntries(left, right) {
  switch (state.planTimelineSort) {
    case "space":
      return (
        left.spaceLabel.localeCompare(right.spaceLabel) ||
        compareTimelineDates(left, right) ||
        compareTimelineHorizons(left, right) ||
        compareTimelineKinds(left, right) ||
        left.title.localeCompare(right.title)
      );
    case "horizon":
      return (
        compareTimelineHorizons(left, right) ||
        compareTimelineDates(left, right) ||
        left.spaceLabel.localeCompare(right.spaceLabel) ||
        compareTimelineKinds(left, right) ||
        left.title.localeCompare(right.title)
      );
    default:
      return (
        compareTimelineDates(left, right) ||
        left.spaceLabel.localeCompare(right.spaceLabel) ||
        compareTimelineHorizons(left, right) ||
        compareTimelineKinds(left, right) ||
        left.title.localeCompare(right.title)
      );
  }
}

function compareTimelineDates(left, right) {
  if (left.timelineStartDate && right.timelineStartDate) {
    return (
      left.timelineStartDate.localeCompare(right.timelineStartDate) ||
      left.timelineEndDate.localeCompare(right.timelineEndDate)
    );
  }

  if (left.timelineStartDate) {
    return -1;
  }

  if (right.timelineStartDate) {
    return 1;
  }

  return 0;
}

function compareTimelineHorizons(left, right) {
  const leftOrder =
    left.horizonOrderIndex ?? getTimelineHorizonOrder(left.horizonKey ?? left.horizonName);
  const rightOrder =
    right.horizonOrderIndex ?? getTimelineHorizonOrder(right.horizonKey ?? right.horizonName);

  return leftOrder - rightOrder || left.horizonLabel.localeCompare(right.horizonLabel);
}

function getTimelineHorizonOrder(value) {
  const order = {
    Now: 0,
    Next: 1,
    Later: 2,
    horizon_1: 0,
    horizon_2: 1,
    horizon_3: 2,
  };

  return order[value] ?? 99;
}

function compareTimelineKinds(left, right) {
  if (left.kind === right.kind) {
    return 0;
  }

  return left.kind === "work-item" ? -1 : 1;
}
