import { syncDocumentEditorAfterRender } from "../documents/documentEditor.js";
import {
  canCurrentUserEditDocuments,
  escapeHtml,
  formatDateTime,
  getDocumentSpaceLabels,
  getUserDisplayName,
  getVisibleDocuments,
  getVisibleSignals,
  hasOpenModal,
  renderMarkdown,
} from "../shared/helpers.js";
import { AREAS, elements, state } from "../state/state.js";
import { getAreaConfig } from "../state/uiOptions.js";
import { renderPlanView } from "./renderPlan.js";
import { renderSettingsModal, renderSettingsView } from "./renderSettings.js";
import {
  renderIcon,
  renderInlineEmptyState,
  renderLoadingStateCard,
  renderPageEmptyState,
  renderRecordTimestampsInline,
  renderStyleAttribute,
} from "./renderShared.js";
import {
  renderIconBadge,
  renderLinkedWorkItem,
  renderWorkItemCollection,
  renderWorkItemModal,
  renderWorkView,
} from "./renderWork.js";

const signalEvidencePrompts = [
  "Who is affected? Customer, account, segment, or internal team if known.",
  "Where did the signal come from? Conversation, support ticket, sales note, usage observation, or link.",
  "What is the impact? Pain, frequency, revenue, risk, workaround, or opportunity size.",
  "What would a good outcome look like?",
];

export function render() {
  const authVisible = state.auth.requiresAuthentication && !state.auth.isAuthenticated;
  document.documentElement.dataset.theme = state.theme;

  document.body.classList.toggle("auth-visible", authVisible);
  document.body.classList.toggle("mobile-nav-open", state.mobileNavOpen);
  if (elements.authRoot instanceof HTMLElement) {
    elements.authRoot.hidden = !authVisible;
  }
  if (elements.appShell instanceof HTMLElement) {
    elements.appShell.hidden = authVisible;
  }
  if (elements.sidebarBackdrop instanceof HTMLElement) {
    elements.sidebarBackdrop.hidden = authVisible || !state.mobileNavOpen;
  }
  renderMobileNavToggle(authVisible);

  renderAuthShell();

  if (authVisible) {
    document.body.classList.remove("has-modal");
    if (elements.modalRoot instanceof HTMLElement) {
      elements.modalRoot.innerHTML = "";
    }
    renderNotifications();
    syncDocumentEditorAfterRender();
    return;
  }

  renderSidebarBrand();
  renderPrimaryNav();
  renderSidebarFooter();
  renderTopbar();
  renderMainPanel();
  renderModalRoot();
  renderNotifications();
  syncDocumentEditorAfterRender();
}

function renderMobileNavToggle(authVisible) {
  if (!(elements.mobileNavToggle instanceof HTMLElement)) {
    return;
  }

  elements.mobileNavToggle.hidden = authVisible;
  elements.mobileNavToggle.setAttribute(
    "aria-label",
    state.mobileNavOpen ? "Close navigation" : "Open navigation",
  );
  elements.mobileNavToggle.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
  elements.mobileNavToggle.innerHTML = renderIcon(state.mobileNavOpen ? "x" : "menu");
}

function renderAuthShell() {
  if (!(elements.authRoot instanceof HTMLElement)) {
    return;
  }

  if (!state.auth.requiresAuthentication || state.auth.isAuthenticated) {
    elements.authRoot.innerHTML = "";
    return;
  }

  const providerButtons =
    state.config?.auth?.enableOAuth === false
      ? ""
      : state.auth.oauthProviders
          .map(
            (provider) => `
              <button
                type="button"
                class="auth-provider-button"
                data-action="start-oauth-sign-in"
                data-provider-id="${escapeHtml(provider.id)}"
              >
                <span class="auth-provider-mark">${escapeHtml(getProviderMark(provider.id))}</span>
                <span>Sign in with ${escapeHtml(provider.name)}</span>
              </button>
            `,
          )
          .join("");
  const showPasswordless = state.config?.auth?.enablePasswordless !== false;
  const showDivider = Boolean(providerButtons) && showPasswordless;

  elements.authRoot.innerHTML = `
    <section class="auth-shell">
      <button class="auth-theme" type="button" data-action="toggle-theme" title="Toggle theme" aria-label="Toggle theme">
        ${renderIcon(state.theme === "dark" ? "sun" : "moon")}
      </button>
      <div class="auth-card">
        <div class="auth-brand">${escapeHtml(state.config?.auth?.title ?? "MikroLens")}</div>
        ${renderAuthBody(providerButtons, showDivider, showPasswordless)}
      </div>
    </section>
  `;
}

function renderAuthBody(providerButtons, showDivider, showPasswordless) {
  const demoUsers = Array.isArray(state.auth.demoUsers) ? state.auth.demoUsers : [];
  const hasDemoUsers = demoUsers.length > 0;
  const heading = "Sign in";
  const supportingCopy = providerButtons
    ? "Use your organization sign-in or request a one-time sign-in link."
    : "Enter your email to request a one-time sign-in link.";
  const demoUsersSection = hasDemoUsers
    ? `
      <div class="auth-demo-users">
        <div class="auth-demo-users-header">
          <h3>Demo users</h3>
        </div>
        <div class="auth-demo-user-list">
          ${demoUsers
            .map((user) => {
              const isPending = state.auth.pendingDemoUserId === user.id;

              return `
                <button
                  type="button"
                  class="auth-demo-user-button"
                  data-action="sign-in-demo-user"
                  data-demo-user-id="${escapeHtml(user.id)}"
                  ${isPending ? "disabled" : ""}
                >
                  <span class="auth-demo-user-copy">
                    <strong>${escapeHtml(getUserDisplayName(user, user.email))}</strong>
                    <span>${escapeHtml(user.email)}</span>
                  </span>
                  <span class="auth-demo-user-meta">
                    <span class="meta-pill">${escapeHtml(user.role)}</span>
                    ${isPending ? "<span>Signing in...</span>" : ""}
                  </span>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `
    : "";
  const shouldShowDivider =
    Boolean(showDivider) ||
    (hasDemoUsers && (Boolean(providerButtons) || Boolean(showPasswordless)));

  if (state.auth.screen === "sent") {
    return `
      <div class="auth-state auth-state-center">
        <div class="auth-copy">
          <h1>Request received</h1>
        </div>
        <p>If this email can sign in, you will receive a sign-in link shortly.</p>
        <button type="button" class="auth-secondary" data-action="show-auth-form">
          Back to sign in
        </button>
      </div>
    `;
  }

  if (state.auth.screen === "error") {
    return `
      <div class="auth-state auth-state-center">
        <div class="auth-copy">
          <h1>Sign-in issue</h1>
        </div>
        <p>${escapeHtml(state.auth.errorMessage || "Try again from the sign-in screen.")}</p>
        <button type="button" class="auth-secondary" data-action="show-auth-form">
          Back to sign in
        </button>
      </div>
    `;
  }

  return `
    <div class="auth-state">
      <div class="auth-copy">
        <h1>${heading}</h1>
        <p>${supportingCopy}</p>
      </div>
      ${providerButtons ? `<div class="auth-provider-list">${providerButtons}</div>` : ""}
      ${shouldShowDivider ? '<div class="auth-divider"><span>or</span></div>' : ""}
      ${
        showPasswordless
          ? `
            <form class="auth-form" data-form="auth-login">
              <label class="form-field">
                <span class="control-label">Email</span>
                <input
                  class="control"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  autocomplete="email"
                  required
                />
              </label>
              <button type="submit" class="auth-submit" ${state.auth.pending ? "disabled" : ""}>
                ${renderIcon("mail")}
                <span>${state.auth.pending ? "Sending..." : "Request sign-in link"}</span>
              </button>
            </form>
          `
          : `
            <p class="auth-supporting-copy">
              Email sign-in is currently disabled for this deployment.
            </p>
          `
      }
      ${demoUsersSection}
    </div>
  `;
}

function renderSidebarBrand() {
  elements.sidebarBrand.innerHTML = `
    <div class="brand-copy">
      <h1>MikroLens</h1>
    </div>
  `;
}

function renderPrimaryNav() {
  const snapshot = state.snapshot;
  const blockedCount =
    snapshot?.understand.counts.blocked ?? snapshot?.understand.blockedItems.length ?? 0;
  const documentCount = snapshot?.documents.length ?? 0;
  const roadmapCount =
    snapshot?.plan.computed.reduce((count, lane) => {
      return (
        count +
        lane.cells.reduce((cellCount, cell) => {
          return cellCount + cell.documents.length;
        }, 0)
      );
    }, 0) ?? 0;
  const signalCount = snapshot?.signals.filter((item) => item.status === "Open").length ?? 0;
  const workCount = snapshot?.workItems.filter((item) => item.state !== "Archived").length ?? 0;
  const settingsCount =
    (snapshot?.spaces.length ?? 0) +
    (snapshot?.apiIdentities.length ?? 0) +
    (snapshot?.users.length ?? 0);

  const labels = {
    Direct: `${documentCount} docs`,
    Intake: `${signalCount} open`,
    Plan: `${roadmapCount} refs`,
    Settings: `${settingsCount} resources`,
    Understand: `${blockedCount} blocked`,
    Work: `${workCount} items`,
  };

  elements.primaryNav.innerHTML = AREAS.map((area) => {
    const areaConfig = getAreaConfig(area);

    return `
      <button
        type="button"
        class="nav-button ${state.activeArea === area ? "is-active" : ""}"
        data-area="${area}"
      >
        <strong>${escapeHtml(areaConfig?.label ?? area)}</strong>
        <span class="nav-count">${escapeHtml(labels[area])}</span>
      </button>
    `;
  }).join("");
}

function renderSidebarFooter() {
  if (!(elements.sidebarFooter instanceof HTMLElement)) {
    return;
  }

  const hasSession = Boolean(state.auth.currentUserEmail);
  const currentUser =
    state.snapshot?.users.find((user) => user.id === state.auth.currentUserId) ?? null;
  const currentUserEmail = state.auth.currentUserEmail;
  const currentUserName = getUserDisplayName(currentUser, currentUserEmail);
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  const themeToggleLabel = `Switch to ${nextTheme} theme`;
  const themeButton = `
    <button
      type="button"
      class="button button-secondary sidebar-icon-button sidebar-theme-button"
      data-action="toggle-theme"
      aria-label="${escapeHtml(themeToggleLabel)}"
      title="${escapeHtml(themeToggleLabel)}"
    >
      ${renderIcon(state.theme === "dark" ? "sun" : "moon")}
    </button>
  `;

  elements.sidebarFooter.innerHTML = `
    <div class="sidebar-footer-group">
      ${
        hasSession
          ? `
            <div class="sidebar-session">
              <div class="sidebar-session-copy">
                <strong>${escapeHtml(currentUserName)}</strong>
              </div>
              <div class="sidebar-footer-tools">
                ${themeButton}
                <button
                  type="button"
                  class="button button-secondary sidebar-icon-button sidebar-session-action"
                  data-action="sign-out"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  ${renderIcon("log-out")}
                </button>
              </div>
            </div>
          `
          : `
            <div class="sidebar-footer-tools">
              ${themeButton}
            </div>
          `
      }
    </div>
  `;
}

function renderTopbar() {
  if (elements.topbar instanceof HTMLElement) {
    elements.topbar.innerHTML = "";
  }
}

function renderMainActions() {
  const controls = renderActionControls().trim();

  if (!controls) {
    return "";
  }

  return `
    <div class="main-action-bar" aria-label="View actions">
      ${controls}
    </div>
  `;
}

function renderActionControls() {
  const spaces = state.spaceOptions;
  const canEditDocuments = canCurrentUserEditDocuments();
  const canCopyCurrentViewLink =
    state.activeArea === "Direct" || state.activeArea === "Plan" || state.activeArea === "Work";
  const settingsControls =
    state.activeArea === "Settings"
      ? ""
      : state.activeArea === "Understand"
        ? `
        <div class="compact-control compact-control-inline">
          <select id="space-select" class="control">
            <option value="">All spaces</option>
            ${spaces
              .map(
                (space) => `
                  <option value="${escapeHtml(space.id)}" ${space.id === state.activeSpaceId ? "selected" : ""}>
                    ${escapeHtml(space.name)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </div>
      `
        : state.activeArea === "Direct"
          ? `
        <div class="compact-control compact-control-inline">
          <select id="space-select" class="control">
            <option value="">All spaces</option>
            ${spaces
              .map(
                (space) => `
                  <option value="${escapeHtml(space.id)}" ${space.id === state.activeSpaceId ? "selected" : ""}>
                    ${escapeHtml(space.name)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </div>
        <button
          type="button"
          class="button button-primary"
          data-action="create-document"
          ${canEditDocuments ? "" : 'disabled title="Document access is required."'}
        >
          ${renderIcon("plus")}
          <span>New document</span>
        </button>
      `
          : state.activeArea === "Intake"
            ? `
        <button type="button" class="button button-primary" data-action="open-suggest">
          ${renderIcon("plus")}
          <span>New signal</span>
        </button>
      `
            : `
        <div class="compact-control compact-control-inline">
          <select id="space-select" class="control">
            <option value="">All spaces</option>
            ${spaces
              .map(
                (space) => `
                  <option value="${escapeHtml(space.id)}" ${space.id === state.activeSpaceId ? "selected" : ""}>
                    ${escapeHtml(space.name)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </div>
        <button type="button" class="button button-primary" data-action="open-capture">
          ${renderIcon("plus")}
          <span>New work item</span>
        </button>
      `;

  return `
      ${
        canCopyCurrentViewLink
          ? `
            <button type="button" class="button button-secondary" data-action="copy-view-link">
              ${renderIcon("link")}
              <span>Copy view link</span>
            </button>
          `
          : ""
      }
      ${settingsControls}
  `;
}

export function renderMainPanel() {
  if (state.loading && !state.snapshot) {
    elements.mainPanel.innerHTML = renderLoadingState();
    return;
  }

  if (state.error && !state.snapshot) {
    elements.mainPanel.innerHTML = `
      <div class="empty-shell">
        <div>
          <h3>MikroLens could not load</h3>
          <p>${escapeHtml(state.error)}</p>
        </div>
      </div>
    `;
    return;
  }

  if (!state.snapshot) {
    return;
  }

  const views = {
    Direct: renderDirectView(),
    Intake: renderIntakeView(),
    Plan: renderPlanView(),
    Settings: renderSettingsView(),
    Understand: renderUnderstandView(),
    Work: renderWorkView(),
  };

  elements.mainPanel.innerHTML = `
    ${renderMainActions()}
    ${views[state.activeArea]}
  `;
}

function getProviderMark(providerId) {
  const marks = {
    github: "GH",
    gitlab: "GL",
    google: "G",
    microsoft: "MS",
  };

  return marks[providerId] ?? providerId.slice(0, 2).toUpperCase();
}

function renderModalRoot() {
  const hasModal = hasOpenModal();
  document.body.classList.toggle("has-modal", hasModal);

  if (!state.snapshot || !hasModal) {
    elements.modalRoot.innerHTML = "";
    return;
  }

  if (state.captureModalOpen) {
    elements.modalRoot.innerHTML = renderModalShell(renderCaptureModal(), {
      chromeTitle: state.captureMode === "signal" ? "New signal" : "New work item",
      size: "modal-narrow",
      title: state.captureMode === "signal" ? "Capture signal" : "Create work record",
    });
    appendModalOverlays();
    return;
  }

  if (state.settingsModal) {
    elements.modalRoot.innerHTML = renderModalShell(renderSettingsModal(), {
      chromeTitle: getSettingsModalChromeTitle(),
      panelClass: "modal-panel-fade",
      size: "modal-narrow",
      title: "Settings",
    });
    appendModalOverlays();
    return;
  }

  const selectedWorkItem = state.snapshot.workItems.find(
    (workItem) => workItem.id === state.selectedWorkItemId,
  );

  if (selectedWorkItem) {
    elements.modalRoot.innerHTML = renderModalShell(renderWorkItemModal(selectedWorkItem), {
      chromeTitle: selectedWorkItem.title,
      panelClass: "modal-panel-fade",
      size: "modal-wide",
      title: selectedWorkItem.title,
    });
    appendModalOverlays();
    return;
  }

  const selectedSignal = state.snapshot.signals.find(
    (signal) => signal.id === state.selectedSignalId,
  );

  if (selectedSignal) {
    elements.modalRoot.innerHTML = renderModalShell(renderSignalModal(selectedSignal), {
      chromeTitle: selectedSignal.title,
      panelClass: "modal-panel-fade",
      size: "modal-wide",
      title: selectedSignal.title,
    });
    appendModalOverlays();
    return;
  }

  if (state.selectedDocumentId) {
    const detail = state.documentDetailsById.get(state.selectedDocumentId);
    const status = state.documentDetailStatusById.get(state.selectedDocumentId) ?? {
      kind: "loading",
    };

    if (!detail) {
      elements.modalRoot.innerHTML = renderModalShell(
        status.kind === "error"
          ? renderLoadingStateCard(
              "Document unavailable",
              status.message ?? "The document details could not be loaded right now.",
              '<button type="button" class="button button-secondary" data-action="retry-document-load">Try again</button>',
            )
          : renderLoadingStateCard("Loading document", "Pulling in the latest document details."),
        {
          panelClass: "modal-panel-slide-in",
          size: state.documentEditId === state.selectedDocumentId ? "modal-editor" : "modal-wide",
          title: "Document",
        },
      );
      appendModalOverlays();
      return;
    }

    try {
      elements.modalRoot.innerHTML = renderModalShell(renderDocumentModal(detail), {
        chromeTitle: detail.title,
        hideClose: true,
        panelClass: "modal-panel-slide-in",
        size: state.documentEditId === detail.id ? "modal-editor" : "modal-wide",
        title: detail.title,
      });
      appendModalOverlays();
    } catch (error) {
      state.documentDetailStatusById.set(state.selectedDocumentId, {
        kind: "error",
        message: error instanceof Error ? error.message : "Document modal could not be rendered.",
      });
      state.documentDetailsById.delete(state.selectedDocumentId);
      elements.modalRoot.innerHTML = renderModalShell(
        renderLoadingStateCard(
          "Document unavailable",
          error instanceof Error ? error.message : "Document modal could not be rendered.",
          '<button type="button" class="button button-secondary" data-action="retry-document-load">Try again</button>',
        ),
        {
          panelClass: "modal-panel-slide-in",
          size: state.documentEditId === state.selectedDocumentId ? "modal-editor" : "modal-wide",
          title: "Document",
        },
      );
      appendModalOverlays();
    }
  }
}

function getSettingsModalChromeTitle() {
  if (!state.settingsModal || !state.snapshot) {
    return "Settings";
  }

  switch (state.settingsModal.kind) {
    case "org-horizons-edit":
      return "Edit Shared Horizon Defaults";
    case "space-horizons-edit": {
      const space = state.snapshot.spaces.find((entry) => entry.id === state.settingsModal.spaceId);
      return space ? `Edit ${space.name} Horizons` : "Edit Space Horizons";
    }
    case "horizon-default-edit":
      return "Edit Horizon Default";
    case "horizon-edit": {
      const horizon = state.snapshot.horizons.find(
        (entry) => entry.id === state.settingsModal.horizonId,
      );
      const space = state.snapshot.spaces.find((entry) => entry.id === horizon?.spaceId);
      return space ? `Edit ${space.name} Horizon` : "Edit Horizon";
    }
    default:
      return "Settings";
  }
}

export function renderNotifications() {
  if (!(elements.toastRoot instanceof HTMLElement)) {
    return;
  }

  if (state.notifications.length === 0) {
    elements.toastRoot.innerHTML = "";
    return;
  }

  elements.toastRoot.innerHTML = `
    <div class="toast-stack">
      ${state.notifications.map((notification) => renderNotification(notification)).join("")}
    </div>
  `;
}

function renderNotification(notification) {
  const toneLabels = {
    error: "Issue",
    info: "Heads up",
    success: "Saved",
    warning: "Check",
  };

  return `
    <section
      class="toast toast-${escapeHtml(notification.tone)}"
      role="${notification.tone === "error" ? "alert" : "status"}"
    >
      <div class="toast-copy">
        <span class="toast-label">${toneLabels[notification.tone] ?? "Notice"}</span>
        <p>${escapeHtml(notification.message)}</p>
      </div>
      <button
        type="button"
        class="toast-dismiss"
        data-action="dismiss-notification"
        data-notification-id="${escapeHtml(notification.id)}"
        aria-label="Dismiss notification"
      >
        Close
      </button>
    </section>
  `;
}

function renderModalShell(content, options) {
  const chromeTitle =
    typeof options.chromeTitle === "string" && options.chromeTitle.trim()
      ? options.chromeTitle.trim()
      : "";

  return `
    <div class="modal-backdrop">
      <div class="modal-surface ${options.size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.title)}">
        ${
          options.hideClose
            ? ""
            : `
              <div class="modal-chrome ${chromeTitle ? "has-title" : "is-actions-only"}">
                ${
                  chromeTitle
                    ? `<div class="modal-chrome-title" title="${escapeHtml(chromeTitle)}">${escapeHtml(chromeTitle)}</div>`
                    : ""
                }
                <div class="modal-chrome-actions">
                  ${options.actions ?? ""}
                  <button
                    type="button"
                    class="button button-secondary modal-close"
                    data-action="close-modal"
                    aria-label="Close"
                  >
                    Close
                  </button>
                </div>
              </div>
            `
        }
        <div class="modal-panel ${options.panelClass ?? ""}">
          ${content}
        </div>
      </div>
    </div>
  `;
}

function renderCloseConfirmDialog() {
  return `
    <div class="modal-confirm-backdrop">
      <div class="surface modal-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm close">
        <div class="modal-header modal-confirm-header">
          <h3>Discard changes?</h3>
          <p>Closing now will lose any unsaved edits in this modal.</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" data-action="cancel-close-modal">Keep editing</button>
          <button type="button" class="button button-primary" data-action="confirm-close-modal">Discard</button>
        </div>
      </div>
    </div>
  `;
}

function appendModalOverlays() {
  if (state.confirmingModalClose) {
    elements.modalRoot.innerHTML += renderCloseConfirmDialog();
  }

  if (state.deleteConfirmation) {
    elements.modalRoot.innerHTML += renderDeleteConfirmDialog();
  }
}

function renderDeleteConfirmDialog() {
  const target = getDeleteConfirmationTarget();

  if (!target) {
    return "";
  }

  return `
    <div class="modal-confirm-backdrop">
      <div class="surface modal-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm delete">
        <div class="modal-header modal-confirm-header">
          <h3>${escapeHtml(target.heading)}</h3>
          <p>${escapeHtml(target.message)}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" data-action="cancel-delete-record">Keep it</button>
          <button type="button" class="button button-danger" data-action="${escapeHtml(target.action)}">${escapeHtml(target.label)}</button>
        </div>
      </div>
    </div>
  `;
}

function getDeleteConfirmationTarget() {
  if (!state.snapshot || !state.deleteConfirmation) {
    return null;
  }

  if (state.deleteConfirmation.kind === "work-item") {
    const workItem = state.snapshot.workItems.find(
      (entry) => entry.id === state.deleteConfirmation.id,
    );

    if (!workItem) {
      return null;
    }

    return {
      action: "confirm-work-item-delete",
      heading: `Remove ${workItem.ref}?`,
      label: "Remove work item",
      message: "This removes the work item, drops any document links, and reopens pulled signals.",
    };
  }

  if (state.deleteConfirmation.kind === "signal") {
    const signal = state.snapshot.signals.find((entry) => entry.id === state.deleteConfirmation.id);

    if (!signal) {
      return null;
    }

    return {
      action: "confirm-signal-delete",
      heading: `Remove ${signal.ref}?`,
      label: "Remove signal",
      message:
        signal.status === "Pulled"
          ? "This removes the intake record only. Any work item already pulled from it will stay in place."
          : "This removes the signal from shared intake.",
    };
  }

  const document =
    state.documentDetailsById.get(state.deleteConfirmation.id) ??
    state.snapshot.documents.find((entry) => entry.id === state.deleteConfirmation.id) ??
    state.allDocuments.find((entry) => entry.id === state.deleteConfirmation.id) ??
    null;

  if (!document) {
    return null;
  }

  return {
    action: "confirm-document-delete",
    heading: `Remove ${document.title}?`,
    label: "Remove document",
    message: "This removes the document and its work links, but keeps the linked work items.",
  };
}

function renderUnderstandView() {
  const snapshot = state.snapshot;
  const openSignals = snapshot.signals.filter((item) => item.status === "Open");
  const directionDocuments = snapshot.documents.filter((document) =>
    ["Strategy", "Evolution"].includes(document.type),
  );
  const roadmapRefs = snapshot.plan.computed.reduce(
    (count, lane) =>
      count + lane.cells.reduce((cellCount, cell) => cellCount + cell.documents.length, 0),
    0,
  );
  const readyOrActiveWork = snapshot.workItems.filter((item) =>
    ["Ready", "Active"].includes(item.state),
  );
  const metrics = snapshot.understand.metrics.map((metric) => renderMetricCard(metric)).join("");

  return `
    <div class="view-stack">
      <section class="product-brief" aria-label="Product operating brief">
        ${renderBriefCard("Signals", `${openSignals.length} open`)}
        ${renderBriefCard("Direction", `${directionDocuments.length} docs`)}
        ${renderBriefCard("Plan", `${roadmapRefs} refs`)}
        ${renderBriefCard("Work", `${readyOrActiveWork.length} ready/active`)}
      </section>
      <section class="metric-grid">${metrics}</section>
      <section class="content-grid two-column">
        <article class="understand-section">
          <div class="section-title">
            <h3>Waiting since last touch</h3>
          </div>
          ${renderDistribution(snapshot.understand.waitDistribution)}
        </article>
        <article class="understand-section">
          <div class="section-title">
            <h3>Completion cycle time</h3>
          </div>
          ${renderDistribution(snapshot.understand.resolutionDistribution)}
        </article>
      </section>
      <section class="understand-section understand-pressure">
        <div class="section-title">
          <h3>Pressure points</h3>
        </div>
        <div class="pressure-grid">
          <section class="pressure-section">
            <h4>Blocked (${snapshot.understand.counts.blocked})</h4>
            <div class="collection-list">
              ${renderWorkItemCollection(snapshot.understand.blockedItems.slice(0, 5), { compact: true })}
            </div>
          </section>
          <section class="pressure-section">
            <h4>Stale (${snapshot.understand.counts.stale})</h4>
            <div class="collection-list">
              ${renderWorkItemCollection(snapshot.understand.staleItems.slice(0, 5), { compact: true })}
            </div>
          </section>
          <section class="pressure-section">
            <h4>Past target (${snapshot.understand.counts.pastTarget})</h4>
            <div class="collection-list">
              ${renderWorkItemCollection(snapshot.understand.pastTargetItems.slice(0, 5), { compact: true })}
            </div>
          </section>
        </div>
      </section>
      <details class="section-accordion understand-changes">
        <summary class="section-accordion-summary">
          <span class="section-accordion-copy">
            <h3>Recent changes</h3>
          </span>
          <span class="section-accordion-meta">
            <span class="meta-pill">${snapshot.understand.recentChanges.length}</span>
            <span class="section-accordion-chevron" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="section-accordion-panel">
          ${
            snapshot.understand.recentChanges.length === 0
              ? renderInlineEmptyState("No recent changes", "New activity will show up here.")
              : `
                <div class="timeline-list">
                  ${snapshot.understand.recentChanges
                    .map(
                      (entry) => `
                        <article class="timeline-item">
                          <div class="timeline-marker"></div>
                          <div>
                            <div class="item-heading">
                              <strong class="item-title">${escapeHtml(formatUnderstandActivityAction(entry.action))}</strong>
                              <span class="meta-pill">${formatDateTime(entry.createdAt)}</span>
                            </div>
                            <p class="item-copy">${escapeHtml(entry.summary)}</p>
                          </div>
                        </article>
                      `,
                    )
                    .join("")}
                </div>
              `
          }
        </div>
      </details>
    </div>
  `;
}

function renderBriefCard(label, value) {
  return `
    <article class="brief-card">
      <span class="brief-card-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderMetricCard(metric) {
  const detail = String(metric.detail ?? "").trim();

  return `
    <article class="metric-card">
      <div class="metric-card-topline">
        <span class="metric-label">${escapeHtml(metric.label)}</span>
        ${
          detail
            ? `
              <span
                class="metric-info"
                tabindex="0"
                aria-label="${escapeHtml(detail)}"
                data-tooltip="${escapeHtml(detail)}"
              >i</span>
            `
            : ""
        }
      </div>
      <strong>${escapeHtml(metric.value)}</strong>
    </article>
  `;
}

function renderDirectView() {
  const documents = getVisibleDocuments();

  return `
    <div class="view-stack">
      <section class="work-toolbar">
        <div class="toolbar-block toolbar-block-search">
          <input
            id="direct-search"
            class="control search-control"
            type="search"
            placeholder="Search documents, spaces..."
            value="${escapeHtml(state.directSearch)}"
          />
          <div class="chip-row">
            <span class="meta-pill">${documents.length} visible</span>
          </div>
        </div>
        <div class="toolbar-block toolbar-block-end">
          <select id="direct-type" class="control control-inline" aria-label="Filter documents by type">
            <option value="">All types</option>
            ${state.snapshot.meta.documentTypes
              .map(
                (type) => `
                  <option value="${escapeHtml(type)}" ${type === state.directType ? "selected" : ""}>
                    ${escapeHtml(type)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </div>
      </section>
      ${
        documents.length === 0
          ? renderPageEmptyState(
              "No documents match",
              "Try a different search or remove the type filter.",
            )
          : `
            <section class="content-grid three-column">
              ${documents
                .map((document) => {
                  const spaceBadges = getDocumentSpaceLabels(document)
                    .map((label) =>
                      renderIconBadge({
                        icon: "space",
                        label,
                      }),
                    )
                    .join("");

                  return `
                    <article class="record-card">
                      <button type="button" class="record-button" data-select-document="${escapeHtml(document.id)}">
                        <div class="record-topline">
                          ${renderIconBadge({
                            classes: "meta-pill",
                            icon: "type",
                            label: document.type,
                          })}
                        </div>
                        <strong class="record-title">${escapeHtml(document.title)}</strong>
                        ${document.summary ? `<p class="item-copy">${escapeHtml(document.summary)}</p>` : ""}
                        <div class="chip-row">
                          ${spaceBadges}
                          ${
                            document.horizonName
                              ? renderIconBadge({
                                  classes: "token token-accent",
                                  icon: "horizon",
                                  label: document.horizonName,
                                })
                              : ""
                          }
                        </div>
                      </button>
                    </article>
                  `;
                })
                .join("")}
            </section>
          `
      }
    </div>
  `;
}

function renderIntakeView() {
  const signals = getVisibleSignals();

  return `
    <div class="view-stack">
      ${
        signals.length === 0
          ? renderPageEmptyState(
              "No open signals",
              "Incoming product signals will stay here until someone pulls them into a space inbox.",
            )
          : `
            <section class="content-grid three-column">
              ${signals.map((item) => renderSignalCard(item)).join("")}
            </section>
          `
      }
    </div>
  `;
}

function renderSignalCard(item) {
  return `
    <article class="record-card"${renderStyleAttribute({ "--space-accent": "var(--accent)" })}>
      <button type="button" class="record-button" data-select-signal="${escapeHtml(item.id)}">
        <div class="record-topline">
          <span class="space-dot"></span>
          <span class="meta-pill">${escapeHtml(item.ref)}</span>
          ${renderSignalStatusToken(item.status)}
        </div>
        <strong class="record-title">${escapeHtml(item.title)}</strong>
        <p class="item-copy">${escapeHtml(item.summary)}</p>
        <div class="chip-row">
          ${item.source ? `<span class="token">${escapeHtml(item.source)}</span>` : ""}
          ${renderSignalUrgencyToken(item.urgency)}
          ${
            item.expectedTimeline
              ? `<span class="token token-accent">${escapeHtml(item.expectedTimeline)}</span>`
              : ""
          }
          ${item.isStale ? `<span class="token token-warn">Stale</span>` : ""}
        </div>
      </button>
    </article>
  `;
}

function renderCaptureModal() {
  if (state.captureMode === "signal") {
    return renderSignalCaptureModal();
  }

  return `
    <form id="quick-capture-form" class="modal-form">
      <label class="form-field">
        <span class="control-label">Title</span>
        <input class="control" name="title" placeholder="Capture a concern, idea, or bug" />
      </label>
      <div class="form-row">
        <label class="form-field">
          <span class="control-label">Type</span>
          <select class="control" name="type">
            ${state.snapshot.meta.workItemTypes
              .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="form-field">
          <span class="control-label">Space</span>
          <select class="control" name="spaceId">
            ${state.spaceOptions
              .map(
                (space) => `
                  <option value="${escapeHtml(space.id)}" ${space.id === state.activeSpaceId ? "selected" : ""}>
                    ${escapeHtml(space.name)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>
      <label class="form-field">
        <span class="control-label">Summary</span>
        <textarea class="textarea" name="summary"></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
        <button type="submit" class="button button-primary">Create work item</button>
      </div>
    </form>
  `;
}

export function renderSignalCaptureModal() {
  return `
    <div class="modal-header">
      <p class="record-lede">
        Keep it lightweight. Capture the signal, who raised it, why it matters, and any evidence that would help a space owner decide whether to shape it.
      </p>
    </div>
    <form id="signal-create-form" class="modal-form">
      <label class="form-field">
        <span class="control-label">Title</span>
        <input class="control" name="title" placeholder="Problem, request, opportunity, or signal" />
      </label>
      <div class="form-row">
        <label class="form-field">
          <span class="control-label">Source</span>
          <input class="control" name="source" placeholder="Name, team, customer, or account" />
        </label>
        <label class="form-field">
          <span class="control-label">Urgency</span>
          <select class="control" name="urgency">
            ${state.snapshot.meta.signalUrgencies
              .map(
                (urgency) => `
                  <option value="${escapeHtml(urgency)}" ${urgency === "Medium" ? "selected" : ""}>
                    ${escapeHtml(urgency)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>
      <label class="form-field">
        <span class="control-label">When does this matter?</span>
        <input class="control" name="expectedTimeline" placeholder="Now, next month, renewal, launch window..." />
      </label>
      <label class="form-field">
        <span class="control-label">Context and evidence</span>
        <textarea class="textarea signal-evidence-textarea" name="summary" placeholder="${escapeHtml(getSignalEvidencePlaceholder())}"></textarea>
      </label>
      ${renderSignalEvidencePrompts()}
      <div class="modal-actions">
        <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
        <button type="submit" class="button button-primary">Capture signal</button>
      </div>
    </form>
  `;
}

function renderSignalModal(signal) {
  const pullTargetSpaces = state.spaceOptions;

  return `
    <div class="modal-header">
      <div class="modal-header-top">
        <div class="chip-row">
          <span class="meta-pill">${escapeHtml(signal.ref)}</span>
          ${renderSignalStatusToken(signal.status)}
          ${renderSignalUrgencyToken(signal.urgency)}
          ${signal.expectedTimeline ? `<span class="token token-accent">${escapeHtml(signal.expectedTimeline)}</span>` : ""}
        </div>
      </div>
      <p class="record-lede">
        Source: <strong>${escapeHtml(signal.source)}</strong>. Preserve customer, source, impact, and outcome clues here until a space owner decides whether it is worth shaping further.
      </p>
      ${renderRecordTimestampsInline(signal.createdAt, signal.updatedAt)}
    </div>
    <div class="modal-grid">
      <form
        id="signal-detail-form"
        data-form="signal-detail-form"
        data-signal-id="${escapeHtml(signal.id)}"
        class="modal-section"
      >
        <div class="section-title">
          <h4>Signal</h4>
          ${renderSignalStatusToken(signal.status)}
        </div>
        <label class="form-field">
          <span class="control-label">Title</span>
          <input class="control" name="title" value="${escapeHtml(signal.title)}" />
        </label>
        <div class="form-row">
          <label class="form-field">
            <span class="control-label">Source</span>
            <input class="control" name="source" value="${escapeHtml(signal.source)}" />
          </label>
          <label class="form-field">
            <span class="control-label">Urgency</span>
            <select class="control" name="urgency">
              ${state.snapshot.meta.signalUrgencies
                .map(
                  (urgency) => `
                    <option value="${escapeHtml(urgency)}" ${urgency === signal.urgency ? "selected" : ""}>
                      ${escapeHtml(urgency)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">When does this matter?</span>
          <input
            class="control"
            name="expectedTimeline"
            value="${escapeHtml(signal.expectedTimeline ?? "")}"
            placeholder="Now, next month, renewal, launch window..."
          />
        </label>
        <label class="form-field">
          <span class="control-label">Context and evidence</span>
          <textarea class="textarea signal-evidence-textarea" name="summary" placeholder="${escapeHtml(getSignalEvidencePlaceholder())}">${escapeHtml(signal.summary)}</textarea>
        </label>
        ${renderSignalEvidencePrompts()}
        <div class="modal-actions">
          ${
            state.capabilities.canDeleteSignals
              ? `
                <button type="button" class="button button-danger" data-action="open-signal-delete">Remove signal</button>
              `
              : ""
          }
          <button type="submit" class="button button-primary">Save signal</button>
        </div>
      </form>
      <aside class="modal-section">
        <div class="section-title">
          <h4>Pull into space</h4>
        </div>
        <p class="item-copy">
          Pulling creates an Idea in the target space's Inbox and marks this signal as pulled.
        </p>
        ${
          signal.status === "Pulled"
            ? `
              <div class="empty-state">
                Pulled into ${escapeHtml(signal.pulledIntoSpace?.name ?? "a space")} as
                ${escapeHtml(signal.pulledIntoWorkItemRef ?? "a work item")}.
              </div>
            `
            : `
              <form
                data-form="signal-pull-form"
                data-signal-id="${escapeHtml(signal.id)}"
                class="modal-form"
              >
                <label class="form-field">
                  <span class="control-label">Destination space</span>
                  <select class="control" name="targetSpaceId">
                    ${pullTargetSpaces
                      .map(
                        (space) => `
                          <option value="${escapeHtml(space.id)}">${escapeHtml(space.name)}</option>
                        `,
                      )
                      .join("")}
                  </select>
                </label>
                <div class="modal-actions">
                  <button type="submit" class="button button-primary">Pull into Inbox</button>
                </div>
              </form>
            `
        }
      </aside>
    </div>
  `;
}

function getSignalEvidencePlaceholder() {
  return [
    "Who is affected?",
    "What happened or what was requested?",
    "Where did the signal come from?",
    "What is the impact or risk?",
    "What would a good outcome look like?",
  ].join("\n");
}

function renderSignalEvidencePrompts() {
  return `
    <section class="signal-evidence-prompts" aria-label="Helpful evidence prompts">
      <span class="surface-caption">Useful evidence</span>
      <ul>
        ${signalEvidencePrompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderDocumentModal(detail) {
  const canEditDocuments = state.capabilities.canEditDocuments && canCurrentUserEditDocuments();
  const editMode = state.documentEditId === detail.id && canEditDocuments;
  const horizons = state.snapshot.horizons.filter((horizon) => horizon.spaceId === detail.spaceId);

  if (editMode) {
    const editor =
      state.documentEditor?.id === detail.id
        ? state.documentEditor
        : {
            collaborators: [],
            connectionState: "connecting",
            horizonId: detail.horizonId ?? null,
            inspectorOpen: false,
            markdown: detail.markdown,
            remoteNotice: "",
            saveError: "",
            saveState: "saved",
            summary: detail.summary,
            title: detail.title,
            type: detail.type,
            view: "write",
          };
    const compactPreview = editor.view === "split" || editor.view === "preview";
    const canDeleteDocument = state.capabilities.canDeleteDocuments && canEditDocuments;

    return `
      <div class="modal-header document-editor-modal-header">
        <div class="modal-header-top">
          <div class="chip-row">
            <span class="meta-pill">${escapeHtml(editor.type)}</span>
            <span class="token">${escapeHtml(detail.spaceName ?? "Standalone")}</span>
            ${
              detail.horizonName
                ? `<span class="token token-accent">${escapeHtml(detail.horizonName)}</span>`
                : ""
            }
            <span class="token">${escapeHtml(getDocumentEditorConnectionLabel(editor.connectionState))}</span>
          </div>
          <div class="modal-header-actions document-editor-actions" aria-label="Document actions">
            ${renderDocumentEditorActionButton({
              action: "copy-document-link",
              icon: "link",
              label: "Copy document link",
            })}
            ${renderDocumentEditorActionButton({
              action: "copy-document-content",
              className: editor.copyState === "copied" ? "is-copied" : "",
              icon: "copy",
              label: editor.copyState === "copied" ? "Document copied" : "Copy document content",
            })}
            ${renderDocumentEditorActionButton({
              action: "download-document-markdown",
              icon: "download",
              label: "Download Markdown",
            })}
            ${
              canDeleteDocument
                ? renderDocumentEditorActionButton({
                    action: "open-document-delete",
                    danger: true,
                    icon: "trash",
                    label: "Remove document",
                  })
                : ""
            }
            ${renderDocumentEditorActionButton({
              action: "close-modal",
              icon: "x",
              label: "Close document",
            })}
          </div>
        </div>
        ${renderRecordTimestampsInline(detail.createdAt, detail.updatedAt)}
      </div>
      <form
        id="document-detail-form"
        data-document-id="${escapeHtml(detail.id)}"
        class="document-editor-shell"
      >
        <section class="modal-section document-editor-main">
          <div class="document-editor-topline">
            <div class="document-editor-modebar">
              <div class="segmented-control">
                <button type="button" class="segment ${editor.view === "write" ? "is-active" : ""}" data-document-view="write">Write</button>
                <button type="button" class="segment ${editor.view === "split" ? "is-active" : ""}" data-document-view="split">Split</button>
                <button type="button" class="segment ${editor.view === "preview" ? "is-active" : ""}" data-document-view="preview">Preview</button>
              </div>
            </div>
            <div class="toolbar-block">
              <span class="editor-status editor-status-${escapeHtml(editor.saveState)}" data-document-editor-status>
                ${escapeHtml(getDocumentEditorStatusLabel(editor))}
              </span>
              <span class="surface-caption" data-document-editor-stats>${escapeHtml(getDocumentEditorStats(editor.markdown))}</span>
            </div>
          </div>
          <label class="form-field document-editor-title-field">
            <span class="control-label">Title</span>
            <input
              class="control document-editor-title-input"
              name="title"
              data-editor-field="title"
              value="${escapeHtml(editor.title)}"
              placeholder="Document title"
            />
          </label>
          ${
            editor.view === "preview"
              ? ""
              : `
                <div class="document-editor-toolbar-row">
                  <div class="document-editor-toolbar" role="toolbar" aria-label="Markdown shortcuts">
                    ${renderMarkdownShortcutButton({
                      label: "Bold",
                      shortcut: "bold",
                      text: "B",
                      title: "Bold (Ctrl/Cmd+B)",
                      keyshortcuts: "Control+B Meta+B",
                    })}
                    ${renderMarkdownShortcutButton({
                      className: "is-italic",
                      label: "Italic",
                      shortcut: "italic",
                      text: "I",
                      title: "Italic (Ctrl/Cmd+I)",
                      keyshortcuts: "Control+I Meta+I",
                    })}
                    ${renderMarkdownShortcutButton({
                      label: "Heading",
                      shortcut: "heading",
                      text: "H",
                      title: "Heading",
                    })}
                    ${renderMarkdownShortcutButton({
                      icon: "list",
                      label: "Bullet list",
                      shortcut: "bullet",
                    })}
                    ${renderMarkdownShortcutButton({
                      icon: "check-square",
                      label: "Checklist",
                      shortcut: "checklist",
                    })}
                    ${renderMarkdownShortcutButton({
                      icon: "quote",
                      label: "Quote",
                      shortcut: "quote",
                    })}
                    ${renderMarkdownShortcutButton({
                      icon: "link",
                      label: "Link",
                      shortcut: "link",
                      title: "Link (Ctrl/Cmd+K)",
                      keyshortcuts: "Control+K Meta+K",
                    })}
                    ${renderMarkdownShortcutButton({
                      icon: "code",
                      label: "Inline code",
                      shortcut: "code",
                    })}
                  </div>
                </div>
              `
          }
          <div class="document-editor-workspace document-editor-workspace-${escapeHtml(editor.view)}">
            ${
              editor.view === "preview"
                ? ""
                : `
                  <div class="document-editor-pane" data-document-editor-pane="write">
                    <label class="form-field">
                      ${editor.view === "write" ? `<span class="control-label">Markdown</span>` : ""}
                      <textarea
                        class="textarea textarea-markdown document-editor-markdown"
                        name="markdown"
                        data-editor-field="markdown"
                        placeholder="# Start writing&#10;&#10;Use markdown to shape the document."
                      >${escapeHtml(editor.markdown)}</textarea>
                    </label>
                  </div>
                `
            }
            ${
              editor.view === "write"
                ? ""
                : `
                  <div class="document-editor-pane document-editor-preview-pane" data-document-editor-pane="preview">
                    ${renderDocumentProseFrame(
                      {
                        markdown: editor.markdown,
                        summary: editor.summary,
                        title: editor.title,
                        type: editor.type,
                      },
                      { compact: compactPreview, preview: true },
                    )}
                  </div>
                `
            }
          </div>
          <div class="document-editor-footnote">
            <span class="muted-note" data-document-editor-note ${getDocumentEditorNote(editor) ? "" : "hidden"}>${escapeHtml(getDocumentEditorNote(editor))}</span>
            <div class="document-editor-presence document-editor-presence-inline" data-document-editor-collaborators>
              ${renderDocumentEditorCollaborators(editor)}
            </div>
          </div>
        </section>
        <section class="modal-section document-editor-details ${editor.inspectorOpen ? "is-open" : ""}">
          <button
            type="button"
            class="document-editor-details-toggle"
            data-action="toggle-document-editor-inspector"
            aria-expanded="${editor.inspectorOpen ? "true" : "false"}"
            aria-controls="document-editor-details-panel"
          >
            <span class="document-editor-details-toggle-copy">
              <span class="document-editor-details-title">Details</span>
            </span>
            <span class="document-editor-details-toggle-meta">
              <span class="surface-caption">${editor.inspectorOpen ? "Hide" : "Show"}</span>
              <span class="document-editor-details-chevron" aria-hidden="true"></span>
            </span>
          </button>
          <div id="document-editor-details-panel" class="document-editor-details-panel" ${editor.inspectorOpen ? "" : "hidden"}>
            <label class="form-field">
              <span class="control-label">Description</span>
              <textarea
                class="textarea document-editor-summary"
                name="summary"
                data-editor-field="summary"
                placeholder="Capture the sharpest summary of this document."
              >${escapeHtml(editor.summary)}</textarea>
            </label>
            <div class="form-row document-editor-sidebar-grid">
              <label class="form-field document-editor-type-field">
                <span class="control-label">Type</span>
                <select class="control" name="type" data-editor-field="type">
                  ${state.snapshot.meta.documentTypes
                    .map(
                      (type) => `
                        <option value="${escapeHtml(type)}" ${type === editor.type ? "selected" : ""}>
                          ${escapeHtml(type)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </label>
              <label class="form-field">
                <span class="control-label">Horizon</span>
                <select class="control" name="horizonId" data-editor-field="horizonId">
                  <option value="">No horizon</option>
                  ${horizons
                    .map(
                      (horizon) => `
                        <option value="${escapeHtml(horizon.id)}" ${
                          horizon.id === editor.horizonId || horizon.name === detail.horizonName
                            ? "selected"
                            : ""
                        }>
                          ${escapeHtml(horizon.name)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </label>
            </div>
            <div class="section-title">
              <h4>Linked work</h4>
              ${renderCountToken(detail.linkedWorkItems.length, "link", "links")}
            </div>
            <div class="collection-list">
              ${
                detail.linkedWorkItems.length === 0
                  ? `<div class="empty-state">No work items are linked yet.</div>`
                  : detail.linkedWorkItems
                      .map((workItem) => renderLinkedWorkItem(workItem))
                      .join("")
              }
            </div>
          </div>
        </section>
      </form>
    `;
  }

  return `
    <div class="modal-header">
      <div class="modal-header-top">
        <div class="chip-row">
          <span class="meta-pill">${escapeHtml(detail.type)}</span>
          <span class="token">${escapeHtml(detail.spaceName ?? "Standalone")}</span>
          ${
            detail.horizonName
              ? `<span class="token token-accent">${escapeHtml(detail.horizonName)}</span>`
              : ""
          }
        </div>
        <div class="modal-header-actions">
          <button type="button" class="button button-secondary" data-action="copy-document-link">
            Copy link
          </button>
          ${
            canEditDocuments
              ? `
                <button type="button" class="button button-secondary" data-action="start-document-edit">Edit document</button>
              `
              : ""
          }
          ${
            state.capabilities.canDeleteDocuments && canEditDocuments
              ? `
                <button type="button" class="button button-danger" data-action="open-document-delete">Remove document</button>
              `
              : ""
          }
        </div>
      </div>
      ${renderRecordTimestampsInline(detail.createdAt, detail.updatedAt)}
    </div>
    <div class="modal-grid document-modal-grid">
      <section class="modal-section document-modal-main">
        ${renderDocumentProseFrame(detail, { compact: true })}
      </section>
      <aside class="modal-section document-modal-sidebar">
        <div class="section-title">
          <h4>Linked work</h4>
          ${renderCountToken(detail.linkedWorkItems.length, "link", "links")}
        </div>
        <div class="collection-list">
          ${
            detail.linkedWorkItems.length === 0
              ? `<div class="empty-state">No work items are linked yet.</div>`
              : detail.linkedWorkItems.map((workItem) => renderLinkedWorkItem(workItem)).join("")
          }
        </div>
      </aside>
    </div>
  `;
}

function renderDocumentProseFrame(detail, options = {}) {
  const hasMarkdown = detail.markdown.trim().length > 0;

  return `
    <section class="document-prose-shell ${options.preview ? "document-prose-shell-preview" : ""}">
      <header class="document-prose-header">
        ${
          options.compact
            ? ""
            : `
              <div class="document-prose-kicker-row">
                ${detail.type ? `<span class="meta-pill">${escapeHtml(detail.type)}</span>` : ""}
                <span class="surface-caption">Markdown document</span>
              </div>
            `
        }
        <div class="document-prose-heading">
          <h1 class="document-prose-title">${escapeHtml(detail.title || "Untitled document")}</h1>
          ${
            detail.summary?.trim()
              ? `<p class="document-prose-summary">${escapeHtml(detail.summary)}</p>`
              : ""
          }
        </div>
      </header>
      <article class="markdown document-prose-body" data-document-editor-preview>
        ${
          hasMarkdown
            ? renderMarkdown(detail.markdown)
            : `<div class="empty-state-inline"><strong>Preview is ready</strong><p>Start writing to see the rendered document.</p></div>`
        }
      </article>
    </section>
  `;
}

function renderDocumentEditorActionButton({ action, className = "", danger = false, icon, label }) {
  const buttonClass = [
    "button",
    danger ? "button-danger" : "button-secondary",
    "document-editor-icon-button",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button
      type="button"
      class="${escapeHtml(buttonClass)}"
      data-action="${escapeHtml(action)}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
    >
      ${renderIcon(icon)}
    </button>
  `;
}

function renderMarkdownShortcutButton({
  className = "",
  icon = "",
  keyshortcuts = "",
  label,
  shortcut,
  text = "",
  title = "",
}) {
  const buttonClass = ["document-editor-tool-button", className].filter(Boolean).join(" ");
  const ariaKeyshortcuts = keyshortcuts ? ` aria-keyshortcuts="${escapeHtml(keyshortcuts)}"` : "";

  return `
    <button
      type="button"
      class="${escapeHtml(buttonClass)}"
      data-markdown-shortcut="${escapeHtml(shortcut)}"
      title="${escapeHtml(title || label)}"
      aria-label="${escapeHtml(label)}"
      ${ariaKeyshortcuts}
    >
      ${icon ? renderIcon(icon) : `<span aria-hidden="true">${escapeHtml(text)}</span>`}
    </button>
  `;
}

function renderCountToken(count, singular, plural) {
  return `<span class="token">${count} ${count === 1 ? singular : plural}</span>`;
}

function getDocumentEditorConnectionLabel(connectionState) {
  if (connectionState === "live") {
    return "Live";
  }

  if (connectionState === "reconnecting") {
    return "Reconnecting";
  }

  if (connectionState === "offline") {
    return "Offline";
  }

  return "Connecting";
}

function getDocumentEditorStatusLabel(editor) {
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
    return "Live update";
  }

  return "Saved";
}

function getDocumentEditorStats(markdown) {
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  return `${words} words`;
}

function getDocumentEditorNote(editor) {
  if (editor.saveError) {
    return editor.saveError;
  }

  if (editor.remoteNotice) {
    return editor.remoteNotice;
  }

  if (editor.connectionState === "offline") {
    return "Collaboration is offline. Local edits will keep autosaving.";
  }

  if (editor.connectionState === "reconnecting") {
    return "Live collaboration is reconnecting.";
  }

  return "";
}

function renderDocumentEditorCollaborators(editor) {
  const collaborators = editor?.collaborators;
  return Array.isArray(collaborators) && collaborators.length > 0
    ? collaborators
        .map(
          (collaborator) => `
              <span class="collaborator-pill"${renderStyleAttribute({ "--collaborator-color": collaborator.color ?? "var(--accent)" })}>
                <span class="collaborator-dot"></span>
                <span>${escapeHtml(collaborator.name ?? "Editor")}</span>
                <span class="collaborator-mode">${escapeHtml(collaborator.mode === "viewing" ? "Viewing" : "Editing")}</span>
              </span>
            `,
        )
        .join("")
    : `
        <span class="collaborator-pill">
          <span class="collaborator-dot"></span>
          <span>You</span>
          <span class="collaborator-mode">Editing</span>
        </span>
      `;
}

function renderDistribution(distribution) {
  const max = Math.max(1, ...distribution.map((entry) => entry.count));

  return `
    <div class="distribution">
      ${distribution
        .map(
          (entry) => `
            <div class="distribution-row">
              <span>${escapeHtml(entry.bucket)}</span>
              <div class="distribution-bar">
                <div class="distribution-fill"${renderStyleAttribute({ width: `${(entry.count / max) * 100}%` })}></div>
              </div>
              <strong>${entry.count}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function formatUnderstandActivityAction(action) {
  const labels = {
    "document.created": "Document created",
    "document.linked": "Document linked",
    "document.unlinked": "Document unlinked",
    "document.updated": "Document updated",
    "state.changed": "State changed",
    "signal.created": "Signal captured",
    "signal.pulled": "Signal pulled",
    "work-item.created": "Work item created",
  };

  return labels[action] ?? action;
}

function renderSignalUrgencyToken(urgency) {
  if (!urgency) {
    return "";
  }

  const classes = {
    High: "token token-danger",
    Low: "token",
    Medium: "token token-warn",
  };

  return `<span class="${classes[urgency] ?? "token"}">${escapeHtml(urgency)}</span>`;
}

function renderSignalStatusToken(status) {
  const classes = {
    Open: "token token-accent",
    Pulled: "token token-ok",
  };

  return `<span class="${classes[status] ?? "token"}">${escapeHtml(status)}</span>`;
}

function renderLoadingState() {
  return `
    <div class="empty-shell">
      ${renderLoadingStateCard("Loading MikroLens", "Pulling in your workspace.")}
    </div>
  `;
}
