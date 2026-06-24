import { DEFAULT_SPACE_ACCENT } from "../shared/defaults.js";
import {
  escapeHtml,
  formatDateTime,
  formatHorizonKey,
  getHorizonDefaultByKey,
  getHorizonLabel,
  getHorizonTimeframe,
  getSortedSpaceHorizons,
  horizonDiffersFromDefault,
} from "../shared/helpers.js";
import { state } from "../state/state.js";
import { renderIcon, renderInlineEmptyState, renderStyleAttribute } from "./renderShared.js";

export function renderSettingsModal() {
  if (!state.snapshot || !state.settingsModal) {
    return "";
  }

  if (state.settingsModal.kind === "api-identity-create") {
    return `
      <div class="modal-header settings-modal-header">
        <div class="settings-modal-eyebrow">
          <span class="meta-pill">API identity</span>
        </div>
        <h3>Create API identity</h3>
        <p class="settings-modal-note">
          Use this for a bot, service integration, or automation actor on the API.
        </p>
      </div>
      <form data-form="api-identity-create" class="modal-form settings-modal-form">
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Name</span>
            <input class="control" name="name" placeholder="Release Bot" />
          </label>
          <label class="form-field">
            <span class="control-label">Status</span>
            <select class="control" name="status">
              ${state.snapshot.meta.apiIdentityStatuses
                .map(
                  (status) =>
                    `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Description</span>
          <textarea class="textarea" name="description" placeholder="What this identity is for."></textarea>
        </label>
        ${renderPermissionsFields()}
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Create identity</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "api-identity-token") {
    return `
      <div class="modal-header settings-modal-header">
        <h3>${escapeHtml(state.settingsModal.apiIdentityName)}</h3>
        <p class="settings-modal-note">
          This token is shown only once after it is ${state.settingsModal.reason === "rotated" ? "rotated" : "created"}.
          Store it where your automation can read it securely.
        </p>
      </div>
      <div class="modal-form settings-modal-form">
        <label class="form-field">
          <span class="control-label">Bearer token</span>
          <textarea class="textarea" readonly>${escapeHtml(state.settingsModal.token)}</textarea>
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-primary" data-action="close-modal">Close</button>
        </div>
      </div>
    `;
  }

  if (state.settingsModal.kind === "api-identity-edit") {
    const apiIdentity = state.snapshot.apiIdentities.find(
      (entry) => entry.id === state.settingsModal.apiIdentityId,
    );

    if (!apiIdentity) {
      return `
        <div class="modal-loading">
          <h3>API identity unavailable</h3>
          <p>This API identity could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          ${renderApiIdentityStatusToken(apiIdentity.status)}
        </div>
        <h3>${escapeHtml(apiIdentity.name)}</h3>
        <p class="settings-modal-note">
          Last used ${escapeHtml(formatLastUsed(apiIdentity.lastUsedAt))}. Token issued ${escapeHtml(formatTokenIssued(apiIdentity.tokenLastRotatedAt))}. This identity can carry scoped board access plus separate global document and intake access.
        </p>
      </div>
      <form
        data-form="api-identity-update"
        data-api-identity-id="${escapeHtml(apiIdentity.id)}"
        class="modal-form settings-modal-form"
      >
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Name</span>
            <input class="control" name="name" value="${escapeHtml(apiIdentity.name)}" />
          </label>
          <label class="form-field">
            <span class="control-label">Status</span>
            <select class="control" name="status">
              ${state.snapshot.meta.apiIdentityStatuses
                .map(
                  (status) => `
                    <option value="${escapeHtml(status)}" ${status === apiIdentity.status ? "selected" : ""}>
                      ${escapeHtml(status)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Description</span>
          <textarea class="textarea" name="description">${escapeHtml(apiIdentity.description)}</textarea>
        </label>
        ${renderPermissionsFields(apiIdentity.permissions)}
        <div class="modal-actions settings-modal-actions">
          <button
            type="button"
            class="button button-secondary"
            data-action="rotate-api-identity-token"
            data-api-identity-id="${escapeHtml(apiIdentity.id)}"
          >
            Rotate token
          </button>
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Save identity</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "user-create") {
    return `
      <div class="modal-header settings-modal-header">
        <div class="settings-modal-eyebrow">
          <span class="meta-pill">User</span>
        </div>
        <h3>Invite user</h3>
        <p class="settings-modal-note">
          Email is the user's identity and where their passwordless sign-in links will be sent.
        </p>
      </div>
      <form data-form="user-create" class="modal-form settings-modal-form">
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Email</span>
            <input class="control" name="email" type="email" placeholder="sam.person@company.com" required />
          </label>
          <label class="form-field">
            <span class="control-label">Role</span>
            <select class="control" name="role">
              ${(state.snapshot.meta.userRoles ?? ["User", "Admin"])
                .map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`)
                .join("")}
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Name</span>
          <input class="control" name="name" placeholder="Sam Person" />
        </label>
        ${renderPermissionsFields()}
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Send invite</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "user-edit") {
    const user = state.snapshot.users.find((entry) => entry.id === state.settingsModal.userId);
    const isCurrentUser = user?.id === state.auth.currentUserId;

    if (!user) {
      return `
        <div class="modal-loading">
          <h3>User unavailable</h3>
          <p>This user could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          ${renderUserStatusToken(user.status)}
          ${renderUserRoleToken(user.role)}
        </div>
        <h3>${escapeHtml(user.name || user.email)}</h3>
        <p class="settings-modal-note">
          Adjust account role, board grants, and the global document and intake surfaces separately.
        </p>
        ${
          isCurrentUser
            ? `
              <p class="item-copy">
                You can update your own name here. Your role and permissions must be changed by another admin.
              </p>
            `
            : ""
        }
      </div>
      <form
        data-form="user-update"
        data-user-id="${escapeHtml(user.id)}"
        class="modal-form settings-modal-form"
      >
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Email</span>
            <input class="control" value="${escapeHtml(user.email)}" readonly />
          </label>
          <label class="form-field">
            <span class="control-label">Role</span>
            <select class="control" name="role" ${isCurrentUser ? "disabled" : ""}>
              ${(state.snapshot.meta.userRoles ?? ["User", "Admin"])
                .map(
                  (role) => `
                    <option value="${escapeHtml(role)}" ${role === user.role ? "selected" : ""}>
                      ${escapeHtml(role)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Name</span>
          <input class="control" name="name" value="${escapeHtml(user.name || "")}" />
        </label>
        ${renderPermissionsFields(user.permissions, { disabled: isCurrentUser })}
        <div class="modal-actions settings-modal-actions">
          <button
            type="button"
            class="button button-secondary"
            data-action="open-user-delete"
            data-user-id="${escapeHtml(user.id)}"
            ${isCurrentUser ? 'disabled title="You cannot delete your own account"' : ""}
          >
            Delete user
          </button>
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Save user</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "user-delete") {
    const user = state.snapshot.users.find((entry) => entry.id === state.settingsModal.userId);

    if (!user) {
      return `
        <div class="modal-loading">
          <h3>User unavailable</h3>
          <p>This user could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          ${renderUserStatusToken(user.status)}
          ${renderUserRoleToken(user.role)}
        </div>
        <h3>Delete ${escapeHtml(user.name || user.email)}?</h3>
        <p class="settings-modal-note">
          This removes the user and any outstanding invite or sign-in links.
        </p>
      </div>
      <div class="modal-form settings-modal-form">
        <label class="form-field">
          <span class="control-label">Email</span>
          <input class="control" value="${escapeHtml(user.email)}" readonly />
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button
            type="button"
            class="button button-primary"
            data-action="confirm-user-delete"
            data-user-id="${escapeHtml(user.id)}"
          >
            Delete user
          </button>
        </div>
      </div>
    `;
  }

  if (state.settingsModal.kind === "webhook-create") {
    return `
      <div class="modal-header settings-modal-header">
        <div class="settings-modal-eyebrow">
          <span class="meta-pill">Webhook</span>
        </div>
        <h3>Create webhook</h3>
        <p class="settings-modal-note">
          Send MikroLens activity to another service without making the main app wait on delivery.
        </p>
      </div>
      <form data-form="webhook-create" class="modal-form settings-modal-form">
        ${renderWebhookFields()}
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Create webhook</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "webhook-edit") {
    const webhook = (state.snapshot.webhooks ?? []).find(
      (entry) => entry.id === state.settingsModal.webhookId,
    );

    if (!webhook) {
      return `
        <div class="modal-loading">
          <h3>Webhook unavailable</h3>
          <p>This webhook endpoint could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          ${renderWebhookStatusToken(webhook.status)}
          <span class="meta-pill">${escapeHtml(formatWebhookScope(webhook))}</span>
        </div>
        <h3>${escapeHtml(webhook.name)}</h3>
        <p class="settings-modal-note">
          Keep subscriptions narrow when you can. MikroLens will queue deliveries and send them from the separate webhook worker.
        </p>
      </div>
      <form
        data-form="webhook-update"
        data-webhook-id="${escapeHtml(webhook.id)}"
        class="modal-form settings-modal-form"
      >
        ${renderWebhookFields(webhook)}
        <div class="modal-actions settings-modal-actions">
          <button
            type="button"
            class="button button-secondary"
            data-action="open-webhook-delete"
            data-webhook-id="${escapeHtml(webhook.id)}"
          >
            Delete webhook
          </button>
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Save webhook</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "webhook-delete") {
    const webhook = (state.snapshot.webhooks ?? []).find(
      (entry) => entry.id === state.settingsModal.webhookId,
    );

    if (!webhook) {
      return `
        <div class="modal-loading">
          <h3>Webhook unavailable</h3>
          <p>This webhook endpoint could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          ${renderWebhookStatusToken(webhook.status)}
        </div>
        <h3>Delete ${escapeHtml(webhook.name)}?</h3>
        <p class="settings-modal-note">
          This removes the endpoint and any queued deliveries that have not been sent yet.
        </p>
      </div>
      <div class="modal-form settings-modal-form">
        <label class="form-field">
          <span class="control-label">URL</span>
          <input class="control" value="${escapeHtml(webhook.url)}" readonly />
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button
            type="button"
            class="button button-primary"
            data-action="confirm-webhook-delete"
            data-webhook-id="${escapeHtml(webhook.id)}"
          >
            Delete webhook
          </button>
        </div>
      </div>
    `;
  }

  if (state.settingsModal.kind === "space-create") {
    return `
      <div class="modal-header settings-modal-header">
        <div class="settings-modal-eyebrow">
          <span class="meta-pill">Space</span>
        </div>
        <h3>Create space</h3>
        <p class="settings-modal-note">Used to group work, documents, and planning horizons.</p>
      </div>
      <form data-form="space-create" class="modal-form settings-modal-form">
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Name</span>
            <input class="control" name="name" placeholder="Product Experience" />
          </label>
          <label class="form-field">
            <span class="control-label">Accent</span>
            <input class="control" name="accent" value="${escapeHtml(DEFAULT_SPACE_ACCENT)}" />
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Description</span>
          <textarea class="textarea" name="description" placeholder="What this space owns."></textarea>
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Create space</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "space-edit") {
    const space = state.snapshot.spaces.find((entry) => entry.id === state.settingsModal.spaceId);

    if (!space) {
      return `
        <div class="modal-loading">
          <h3>Space unavailable</h3>
          <p>This space could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <h3>${escapeHtml(space.name)}</h3>
        <p class="settings-modal-note">Update how this Space appears across MikroLens.</p>
      </div>
      <form data-form="space-update" data-space-id="${escapeHtml(space.id)}" class="modal-form settings-modal-form">
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Name</span>
            <input class="control" name="name" value="${escapeHtml(space.name)}" />
          </label>
          <label class="form-field">
            <span class="control-label">Accent</span>
            <input class="control" name="accent" value="${escapeHtml(space.accent)}" />
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Description</span>
          <textarea class="textarea" name="description">${escapeHtml(space.description)}</textarea>
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Save space</button>
        </div>
      </form>
    `;
  }

  if (state.settingsModal.kind === "org-horizons-edit") {
    const horizonDefaults = [...(state.snapshot.horizonDefaults ?? [])].sort(
      (left, right) => left.orderIndex - right.orderIndex,
    );

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          <span class="meta-pill">Organization defaults</span>
        </div>
        <p class="settings-modal-note">
          These defaults seed new Spaces and act as the inherited baseline unless a Space adds its own Horizon override.
        </p>
      </div>
      <div class="modal-form settings-modal-form">
        <section class="settings-horizon-stack" aria-label="Organization Horizon defaults">
          ${horizonDefaults
            .map(
              (horizonDefault) => `
                <article class="settings-horizon-modal-card">
                  <header class="settings-card-header">
                    <div class="settings-card-heading">
                      <h4>${escapeHtml(horizonDefault.label)}</h4>
                    </div>
                    <div class="settings-card-actions">
                      <button
                        type="button"
                        class="button button-secondary"
                        data-action="open-horizon-default-edit"
                        data-horizon-default-key="${escapeHtml(horizonDefault.key)}"
                      >
                        Edit default
                      </button>
                    </div>
                  </header>
                  <p class="item-copy">${escapeHtml(horizonDefault.timeframeText)}</p>
                  <p class="item-copy">${escapeHtml(horizonDefault.description)}</p>
                </article>
              `,
            )
            .join("")}
        </section>
      </div>
    `;
  }

  if (state.settingsModal.kind === "space-horizons-edit") {
    const space = state.snapshot.spaces.find((entry) => entry.id === state.settingsModal.spaceId);
    const horizons = space ? getSortedSpaceHorizons(space.id) : [];

    if (!space) {
      return `
        <div class="modal-loading">
          <h3>Space unavailable</h3>
          <p>This space could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <h3>${escapeHtml(space.name)} horizons</h3>
        <p class="settings-modal-note">
          Review this Space's three Horizons and edit any override that should differ from the organization defaults.
        </p>
      </div>
      <div class="modal-form settings-modal-form">
        <section class="settings-horizon-stack" aria-label="${escapeHtml(space.name)} horizons">
          ${horizons
            .map(
              (horizon) => `
                <article class="settings-horizon-modal-card">
                  <header class="settings-card-header">
                    <div class="settings-card-heading">
                      ${renderHorizonOriginBadge(horizon)}
                      <h4>${escapeHtml(getHorizonLabel(horizon))}</h4>
                    </div>
                    <div class="settings-card-actions">
                      <button
                        type="button"
                        class="button button-secondary"
                        data-action="open-horizon-edit"
                        data-horizon-id="${escapeHtml(horizon.id)}"
                      >
                        Edit horizon
                      </button>
                    </div>
                  </header>
                  <p class="item-copy">${escapeHtml(getHorizonTimeframe(horizon))}</p>
                  <p class="item-copy">${escapeHtml(horizon.description)}</p>
                </article>
              `,
            )
            .join("")}
        </section>
      </div>
    `;
  }

  if (state.settingsModal.kind === "horizon-default-edit") {
    const horizonDefault = getHorizonDefaultByKey(state.settingsModal.horizonDefaultKey);

    if (!horizonDefault) {
      return `
        <div class="modal-loading">
          <h3>Horizon default unavailable</h3>
          <p>This organization-wide Horizon could not be found.</p>
        </div>
      `;
    }

    return `
      <div class="modal-header settings-modal-header">
        <div class="record-topline settings-modal-eyebrow">
          <span class="meta-pill">${escapeHtml(formatHorizonKey(horizonDefault.key))}</span>
        </div>
        <p class="settings-modal-note">
          These defaults seed new Spaces and act as the inherited baseline unless a Space adds its own Horizon override.
        </p>
      </div>
      <form
        data-form="horizon-default-update"
        data-horizon-default-key="${escapeHtml(horizonDefault.key)}"
        class="modal-form settings-modal-form"
      >
        <div class="form-row settings-modal-grid">
          <label class="form-field">
            <span class="control-label">Label</span>
            <input class="control" name="label" value="${escapeHtml(horizonDefault.label)}" />
          </label>
          <label class="form-field">
            <span class="control-label">Timeframe guidance</span>
            <input class="control" name="timeframeText" value="${escapeHtml(horizonDefault.timeframeText)}" />
          </label>
        </div>
        <label class="form-field">
          <span class="control-label">Description</span>
          <textarea class="textarea settings-textarea" name="description">${escapeHtml(horizonDefault.description)}</textarea>
        </label>
        <div class="modal-actions settings-modal-actions">
          <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Save defaults</button>
        </div>
      </form>
    `;
  }

  const horizon = state.snapshot.horizons.find(
    (entry) => entry.id === state.settingsModal.horizonId,
  );
  const space = state.snapshot.spaces.find((entry) => entry.id === horizon?.spaceId);
  const horizonDefault = horizon ? getHorizonDefaultByKey(horizon.key) : null;

  if (!horizon || !space || !horizonDefault) {
    return `
      <div class="modal-loading">
        <h3>Horizon unavailable</h3>
        <p>This planning lane could not be found.</p>
      </div>
    `;
  }

  return `
    <div class="modal-header settings-modal-header">
      <div class="record-topline settings-modal-eyebrow">
        <span class="space-dot"${renderStyleAttribute({ "--space-accent": space.accent })}></span>
        <span class="token token-accent">${escapeHtml(getHorizonLabel(horizon))}</span>
      </div>
      <h3>${escapeHtml(space.name)}</h3>
      <p class="settings-modal-note">
        Turn on a Space override to customize this Horizon. Leave it off to inherit the organization defaults.
      </p>
    </div>
    <form data-form="horizon-update" data-horizon-id="${escapeHtml(horizon.id)}" class="modal-form settings-modal-form">
      <div class="settings-space-stack">
        <label class="settings-checkbox-card">
          <input type="checkbox" name="useOverride" ${horizon.inheritsDefault ? "" : "checked"} />
          <span class="settings-checkbox-indicator" aria-hidden="true"></span>
          <span class="settings-checkbox-copy">
            <strong>Use Space override</strong>
            <span class="item-copy">
              Inherited default from ${escapeHtml(formatHorizonKey(horizonDefault.key))}: ${escapeHtml(horizonDefault.label)}. ${escapeHtml(horizonDefault.timeframeText)}
            </span>
          </span>
        </label>
      </div>
      <div class="form-row settings-modal-grid">
        <label class="form-field">
          <span class="control-label">Label</span>
          <input
            class="control"
            name="label"
            data-horizon-override-field
            value="${escapeHtml(getHorizonLabel(horizon))}"
            ${horizon.inheritsDefault ? "disabled" : ""}
          />
        </label>
        <label class="form-field">
          <span class="control-label">Timeframe guidance</span>
          <input
            class="control"
            name="timeframeText"
            data-horizon-override-field
            value="${escapeHtml(getHorizonTimeframe(horizon))}"
            ${horizon.inheritsDefault ? "disabled" : ""}
          />
        </label>
      </div>
      <label class="form-field">
        <span class="control-label">Description</span>
        <textarea
          class="textarea settings-textarea"
          name="description"
          data-horizon-override-field
          ${horizon.inheritsDefault ? "disabled" : ""}
        >${escapeHtml(horizon.description)}</textarea>
      </label>
      <div class="modal-actions settings-modal-actions">
        <button type="button" class="button button-secondary" data-action="close-modal">Cancel</button>
        <button type="submit" class="button button-primary">Save horizon</button>
      </div>
    </form>
  `;
}

export function renderSettingsView() {
  const apiIdentities = state.snapshot.apiIdentities ?? [];
  const users = state.snapshot.users ?? [];
  const webhooks = state.snapshot.webhooks ?? [];
  const activeApiIdentities = apiIdentities.filter(
    (identity) => identity.status === "Active",
  ).length;
  const neverUsedApiIdentities = apiIdentities.filter((identity) => !identity.lastUsedAt).length;
  const adminUsers = users.filter((user) => user.role === "Admin").length;
  const invitedUsers = users.filter((user) => user.status === "Invited").length;
  const activeWebhooks = webhooks.filter((webhook) => webhook.status === "Active").length;
  const scopedWebhooks = webhooks.filter((webhook) => webhook.spaceId).length;

  return `
    <div class="view-stack">
      <div class="settings-switcher">
        <div class="segmented-control" aria-label="Settings sections">
          <button
            type="button"
            class="segment ${state.settingsSubview === "spaces" ? "is-active" : ""}"
            data-settings-subview="spaces"
          >
            Spaces
          </button>
          <button
            type="button"
            class="segment ${state.settingsSubview === "horizons" ? "is-active" : ""}"
            data-settings-subview="horizons"
          >
            Horizons
          </button>
          <button
            type="button"
            class="segment ${state.settingsSubview === "users" ? "is-active" : ""}"
            data-settings-subview="users"
          >
            Users
          </button>
          <button
            type="button"
            class="segment ${state.settingsSubview === "api-identities" ? "is-active" : ""}"
            data-settings-subview="api-identities"
          >
            API identities
          </button>
          <button
            type="button"
            class="segment ${state.settingsSubview === "webhooks" ? "is-active" : ""}"
            data-settings-subview="webhooks"
          >
            Webhooks
          </button>
        </div>
        ${renderSettingsSubviewAction()}
      </div>
      ${
        state.settingsSubview === "api-identities"
          ? renderApiIdentitySettingsPanel(
              apiIdentities,
              activeApiIdentities,
              neverUsedApiIdentities,
            )
          : state.settingsSubview === "horizons"
            ? renderHorizonSettingsPanel()
            : state.settingsSubview === "webhooks"
              ? renderWebhookSettingsPanel(webhooks, activeWebhooks, scopedWebhooks)
              : state.settingsSubview === "users"
                ? renderUserSettingsPanel(users, adminUsers, invitedUsers)
                : renderSpaceSettingsPanel()
      }
    </div>
  `;
}

function renderHorizonOriginBadge(horizon) {
  const isOverride = horizonDiffersFromDefault(horizon);

  return `
    <div class="record-topline">
      <span class="token ${isOverride ? "token-accent" : ""}">${isOverride ? "Override" : "Default"}</span>
    </div>
  `;
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderSettingsSubviewAction() {
  const actions = {
    spaces: {
      action: "open-space-create",
      label: "New space",
    },
    users: {
      action: "open-user-create",
      label: "Invite user",
    },
    "api-identities": {
      action: "open-api-identity-create",
      label: "New API identity",
    },
    webhooks: {
      action: "open-webhook-create",
      label: "New webhook",
    },
  };
  const config = actions[state.settingsSubview];

  if (!config) {
    return "";
  }

  return `
    <button
      type="button"
      class="button button-primary settings-switcher-action"
      data-action="${escapeHtml(config.action)}"
    >
      ${renderIcon("plus")}
      <span>${escapeHtml(config.label)}</span>
    </button>
  `;
}

function renderSpaceSettingsPanel() {
  const spaces = state.snapshot.spaces;

  return `
    <div class="settings-summary-strip" aria-label="Space totals">
      <span class="meta-pill">${spaces.length} spaces</span>
    </div>
    <section class="settings-space-stack settings-card-stack">
      ${spaces
        .map((space) => {
          const horizons = getSortedSpaceHorizons(space.id);
          const overrideCount = horizons.filter((horizon) =>
            horizonDiffersFromDefault(horizon),
          ).length;

          return `
            <article class="surface surface-compact settings-space-card"${renderStyleAttribute({ "--space-accent": space.accent })}>
              <header class="settings-card-header">
                <div class="settings-card-heading">
                  <h3 class="settings-space-title">
                    <span class="space-dot"></span>
                    <span>${escapeHtml(space.name)}</span>
                  </h3>
                  <p class="item-copy">${escapeHtml(space.description)}</p>
                </div>
                <div class="settings-card-actions">
                  <button
                    type="button"
                    class="button button-secondary"
                    data-action="open-space-edit"
                    data-space-id="${escapeHtml(space.id)}"
                  >
                    Edit space
                  </button>
                </div>
              </header>
              <div class="settings-card-footer settings-card-footer-start">
                <span class="meta-pill">${formatCountLabel(overrideCount, "override")}</span>
              </div>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderHorizonSettingsPanel() {
  const spaces = state.snapshot.spaces;
  const horizonDefaults = [...(state.snapshot.horizonDefaults ?? [])].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );
  const overrideCount = (state.snapshot.horizons ?? []).filter(
    (horizon) =>
      horizonDiffersFromDefault(horizon) && spaces.some((space) => space.id === horizon.spaceId),
  ).length;

  return `
    <div class="settings-summary-strip" aria-label="Horizon totals">
      <span class="meta-pill">${spaces.length} spaces</span>
      <span class="meta-pill">${formatCountLabel(overrideCount, "space override")}</span>
    </div>
    <section class="settings-space-stack settings-card-stack">
      <article class="surface surface-compact settings-space-card">
        <header class="settings-card-header">
          <div class="settings-card-heading">
            <div class="record-topline">
              <span class="meta-pill">Organization defaults</span>
            </div>
            <h3>Shared Horizon defaults</h3>
            <p class="item-copy">
              These three Horizons stay fixed under the hood as Horizon 1, Horizon 2, and Horizon 3.
              Labels and explanatory copy can still be tailored here.
            </p>
          </div>
          <div class="settings-card-actions">
            <button
              type="button"
              class="button button-secondary"
              data-action="open-org-horizons-edit"
            >
              Edit defaults
            </button>
          </div>
        </header>
        <section class="settings-horizon-grid" aria-label="Horizon defaults">
          ${horizonDefaults
            .map(
              (horizonDefault) => `
                <article class="settings-horizon-card stack-column">
                  <div class="record-topline">
                    <span class="token token-accent">Default</span>
                  </div>
                  <div class="section-title section-title-compact">
                    <h4>${escapeHtml(horizonDefault.label)}</h4>
                  </div>
                  <p class="item-copy">${escapeHtml(horizonDefault.timeframeText)}</p>
                  <p class="item-copy">${escapeHtml(horizonDefault.description)}</p>
                </article>
              `,
            )
            .join("")}
        </section>
      </article>
      ${spaces
        .map((space) => {
          const horizons = getSortedSpaceHorizons(space.id);

          return `
            <article class="surface surface-compact settings-space-card"${renderStyleAttribute({ "--space-accent": space.accent })}>
              <header class="settings-card-header">
                <div class="settings-card-heading">
                  <h3 class="settings-space-title">
                    <span class="space-dot"></span>
                    <span>${escapeHtml(space.name)}</span>
                  </h3>
                  <p class="item-copy">Edit how each Horizon is presented in this Space.</p>
                </div>
                <div class="settings-card-actions">
                  <button
                    type="button"
                    class="button button-secondary"
                    data-action="open-space-horizons-edit"
                    data-space-id="${escapeHtml(space.id)}"
                  >
                    Edit Space's horizons
                  </button>
                </div>
              </header>
              <section class="settings-horizon-grid" aria-label="${escapeHtml(space.name)} horizons">
                ${horizons
                  .map(
                    (horizon) => `
                      <article class="settings-horizon-card stack-column">
                        ${renderHorizonOriginBadge(horizon)}
                        <div class="section-title section-title-compact">
                          <h4>${escapeHtml(getHorizonLabel(horizon))}</h4>
                        </div>
                        <p class="item-copy">${escapeHtml(getHorizonTimeframe(horizon))}</p>
                        <p class="item-copy">${escapeHtml(horizon.description)}</p>
                      </article>
                    `,
                  )
                  .join("")}
              </section>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderApiIdentitySettingsPanel(
  apiIdentities,
  activeApiIdentities,
  neverUsedApiIdentities,
) {
  return `
    <div class="settings-summary-strip" aria-label="API identity totals">
      <span class="meta-pill">${apiIdentities.length} API identities</span>
      <span class="meta-pill">${activeApiIdentities} active</span>
      <span class="meta-pill">${neverUsedApiIdentities} never used</span>
    </div>
    <section class="settings-space-stack settings-card-stack">
      ${
        apiIdentities.length === 0
          ? renderInlineEmptyState(
              "No API identities yet",
              "Create one when you need a non-human actor for automation or integrations.",
            )
          : apiIdentities
              .map(
                (identity) => `
                  <article class="surface surface-compact settings-space-card">
                    <header class="settings-card-header">
                      <div class="settings-card-heading">
                        <div class="record-topline">
                          ${renderApiIdentityStatusToken(identity.status)}
                        </div>
                        <h3>${escapeHtml(identity.name)}</h3>
                        <p class="item-copy">${escapeHtml(identity.description)}</p>
                      </div>
                      <div class="settings-card-actions">
                        <button
                          type="button"
                          class="button button-secondary"
                          data-action="open-api-identity-edit"
                          data-api-identity-id="${escapeHtml(identity.id)}"
                        >
                          Edit identity
                        </button>
                      </div>
                    </header>
                    <div class="settings-card-footer settings-card-footer-start">
                      <span class="meta-pill">Access: ${escapeHtml(formatPermissionsSummary(identity.permissions))}</span>
                      <span class="meta-pill">Last used: ${escapeHtml(formatLastUsed(identity.lastUsedAt))}</span>
                      <span class="token">Token issued: ${escapeHtml(formatTokenIssued(identity.tokenLastRotatedAt))}</span>
                      <span class="token">Updated ${escapeHtml(formatDateTime(identity.updatedAt))}</span>
                    </div>
                  </article>
                `,
              )
              .join("")
      }
    </section>
  `;
}

function renderUserSettingsPanel(users, adminUsers, invitedUsers) {
  return `
    <div class="settings-summary-strip" aria-label="User totals">
      <span class="meta-pill">${users.length} users</span>
      <span class="meta-pill">${adminUsers} admins</span>
      <span class="meta-pill">${invitedUsers} invited</span>
    </div>
    <section class="settings-space-stack settings-card-stack">
      ${
        users.length === 0
          ? renderInlineEmptyState(
              "No users yet",
              "Invite the first person who should be able to sign in with an emailed link.",
            )
          : users
              .map(
                (user) => `
                  <article class="surface surface-compact settings-space-card">
                    <header class="settings-card-header">
                      <div class="settings-card-heading">
                        <div class="record-topline">
                          ${renderUserStatusToken(user.status)}
                          ${renderUserRoleToken(user.role)}
                        </div>
                        <h3>${escapeHtml(user.name || user.email)}</h3>
                        <p class="item-copy">${escapeHtml(user.email)}</p>
                      </div>
                      <div class="settings-card-actions">
                        <button
                          type="button"
                          class="button button-secondary"
                          data-action="open-user-edit"
                          data-user-id="${escapeHtml(user.id)}"
                        >
                          Manage access
                        </button>
                      </div>
                    </header>
                    <div class="settings-card-footer settings-card-footer-start">
                      <span class="meta-pill">Access: ${escapeHtml(formatPermissionsSummary(user.permissions))}</span>
                      <span class="meta-pill">Invited ${escapeHtml(formatDateTime(user.invitedAt))}</span>
                      <span class="token">Last sign-in: ${escapeHtml(formatUserLastSignIn(user.lastSignedInAt))}</span>
                      <span class="token">Updated ${escapeHtml(formatDateTime(user.updatedAt))}</span>
                    </div>
                  </article>
                `,
              )
              .join("")
      }
    </section>
  `;
}

function renderWebhookSettingsPanel(webhooks, activeWebhooks, scopedWebhooks) {
  return `
    <div class="settings-summary-strip" aria-label="Webhook totals">
      <span class="meta-pill">${webhooks.length} webhooks</span>
      <span class="meta-pill">${activeWebhooks} active</span>
      <span class="meta-pill">${scopedWebhooks} scoped to one space</span>
    </div>
    <section class="settings-space-stack settings-card-stack">
      ${
        webhooks.length === 0
          ? renderInlineEmptyState(
              "No webhooks yet",
              "Add an endpoint when another system should react to MikroLens changes.",
            )
          : webhooks
              .map(
                (webhook) => `
                  <article class="surface surface-compact settings-space-card">
                    <header class="settings-card-header">
                      <div class="settings-card-heading">
                        <div class="record-topline">
                          ${renderWebhookStatusToken(webhook.status)}
                          <span class="meta-pill">${escapeHtml(formatWebhookScope(webhook))}</span>
                        </div>
                        <h3>${escapeHtml(webhook.name)}</h3>
                        <p class="item-copy">${escapeHtml(webhook.url)}</p>
                      </div>
                      <div class="settings-card-actions">
                        <button
                          type="button"
                          class="button button-secondary"
                          data-action="open-webhook-edit"
                          data-webhook-id="${escapeHtml(webhook.id)}"
                        >
                          Edit webhook
                        </button>
                      </div>
                    </header>
                    <div class="settings-card-footer settings-card-footer-start">
                      <span class="meta-pill">Events: ${escapeHtml(formatWebhookEventSummary(webhook.subscribedEvents))}</span>
                      <span class="token">Secret stored for signing</span>
                      <span class="token">Updated ${escapeHtml(formatDateTime(webhook.updatedAt))}</span>
                    </div>
                  </article>
                `,
              )
              .join("")
      }
    </section>
  `;
}

function renderApiIdentityStatusToken(status) {
  const classes = {
    Active: "token token-ok",
    Paused: "token token-warn",
    Revoked: "token token-danger",
  };

  return `<span class="${classes[status] ?? "token"}">${escapeHtml(status)}</span>`;
}

function renderUserStatusToken(status) {
  const classes = {
    Active: "token token-ok",
    Invited: "token token-warn",
  };

  return `<span class="${classes[status] ?? "token"}">${escapeHtml(status)}</span>`;
}

function renderUserRoleToken(role) {
  const classes = {
    Admin: "token token-accent",
    User: "token",
  };

  return `<span class="${classes[role] ?? "token"}">${escapeHtml(role)}</span>`;
}

function renderPermissionsFields(permissions, options = {}) {
  const accessLevels = state.snapshot.meta.accessLevels ?? ["viewer", "editor", "admin"];
  const spaces = state.snapshot.spaces ?? [];
  const useAllBoards = (permissions?.boards?.scope ?? "all") === "all";
  const allBoardsLevel = permissions?.boards?.scope === "all" ? permissions.boards.level : "viewer";
  const disabled = Boolean(options.disabled);
  const boardGrantLevels = new Map(
    (permissions?.boards?.scope === "boards" ? permissions.boards.grants : []).map((grant) => [
      grant.boardId,
      grant.level,
    ]),
  );

  return `
    <section class="form-field">
      <span class="control-label">Permissions</span>
      <div class="settings-space-stack">
        <label class="settings-checkbox-card">
          <input
            type="checkbox"
            name="boardsScopeAll"
            ${useAllBoards ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span class="settings-checkbox-indicator" aria-hidden="true"></span>
          <span class="settings-checkbox-copy">
            <strong>Use one permission level for all boards</strong>
            <span class="item-copy">
              Turn this on for blanket board access. Turn it off to manage permissions per board.
            </span>
          </span>
        </label>
        <div class="form-row settings-modal-grid">
          <label
            class="form-field"
            data-permissions-all-boards
            ${useAllBoards ? "" : "hidden"}
            aria-hidden="${useAllBoards ? "false" : "true"}"
          >
            <span class="control-label">Boards</span>
            <select class="control" name="boardsAllLevel" ${useAllBoards && !disabled ? "" : "disabled"}>
              ${renderAccessLevelOptions(accessLevels, allBoardsLevel)}
            </select>
          </label>
          <label class="form-field">
            <span class="control-label">Documents</span>
            <select class="control" name="documentsLevel" ${disabled ? "disabled" : ""}>
              ${renderAccessLevelOptions(accessLevels, permissions?.documents ?? null)}
            </select>
          </label>
          <label class="form-field">
            <span class="control-label">Intake</span>
            <select class="control" name="signalsLevel" ${disabled ? "disabled" : ""}>
              ${renderAccessLevelOptions(accessLevels, permissions?.signals ?? null)}
            </select>
          </label>
        </div>
        <div
          class="settings-space-stack"
          data-permissions-board-grants
          ${useAllBoards ? "hidden" : ""}
          aria-hidden="${useAllBoards ? "true" : "false"}"
        >
          <p class="item-copy">
            Set access per board. Leave a board empty if this actor should have no access there.
          </p>
          ${spaces
            .map(
              (space) => `
                <label class="form-field">
                  <span class="control-label">${escapeHtml(space.name)}</span>
                  <select
                    class="control"
                    name="boardLevel:${escapeHtml(space.id)}"
                    ${useAllBoards || disabled ? "disabled" : ""}
                  >
                    ${renderAccessLevelOptions(accessLevels, boardGrantLevels.get(space.id) ?? null)}
                  </select>
                </label>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderWebhookFields(webhook) {
  const statuses = state.snapshot.meta.webhookEndpointStatuses ?? ["Active", "Paused"];
  const eventTypes = state.snapshot.meta.webhookEventTypes ?? [];
  const spaces = state.snapshot.spaces ?? [];
  const selectedEvents = new Set(webhook?.subscribedEvents ?? []);

  return `
    <div class="form-row settings-modal-grid">
      <label class="form-field">
        <span class="control-label">Name</span>
        <input class="control" name="name" value="${escapeHtml(webhook?.name ?? "")}" placeholder="Release events" />
      </label>
      <label class="form-field">
        <span class="control-label">Status</span>
        <select class="control" name="status">
          ${statuses
            .map(
              (status) => `
                <option value="${escapeHtml(status)}" ${status === (webhook?.status ?? "Active") ? "selected" : ""}>
                  ${escapeHtml(status)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    </div>
    <label class="form-field">
      <span class="control-label">URL</span>
      <input
        class="control"
        name="url"
        type="url"
        value="${escapeHtml(webhook?.url ?? "")}"
        placeholder="https://example.com/webhooks/mikrolens"
      />
    </label>
    <div class="form-row settings-modal-grid">
      <label class="form-field">
        <span class="control-label">Secret</span>
        <input
          class="control"
          name="secret"
          value="${escapeHtml(webhook?.secret ?? "")}"
          placeholder="${escapeHtml(webhook ? "Leave blank to keep the current secret" : "Shared signing secret")}"
        />
      </label>
      <label class="form-field">
        <span class="control-label">Scope</span>
        <select class="control" name="spaceId">
          <option value="">All spaces</option>
          ${spaces
            .map(
              (space) => `
                <option value="${escapeHtml(space.id)}" ${space.id === (webhook?.spaceId ?? "") ? "selected" : ""}>
                  ${escapeHtml(space.name)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    </div>
    <section class="form-field">
      <span class="control-label">Events</span>
      <div class="settings-space-stack">
        <p class="item-copy">
          Choose the event families or exact events this endpoint should receive.
        </p>
        <div class="settings-space-stack">
          ${eventTypes
            .map(
              (eventType) => `
                <label class="settings-checkbox-card">
                  <input
                    type="checkbox"
                    name="subscribedEvents"
                    value="${escapeHtml(eventType)}"
                    ${selectedEvents.has(eventType) ? "checked" : ""}
                  />
                  <span class="settings-checkbox-indicator" aria-hidden="true"></span>
                  <span class="settings-checkbox-copy">
                    <strong>${escapeHtml(eventType)}</strong>
                    <span class="item-copy">${escapeHtml(describeWebhookEventType(eventType))}</span>
                  </span>
                </label>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderAccessLevelOptions(accessLevels, selectedLevel, options = {}) {
  const includeNone = options.includeNone ?? true;
  const optionMarkup = accessLevels
    .map(
      (level) => `
        <option value="${escapeHtml(level)}" ${selectedLevel === level ? "selected" : ""}>
          ${escapeHtml(capitalizeAccessLevel(level))}
        </option>
      `,
    )
    .join("");

  if (!includeNone) {
    return optionMarkup;
  }

  return `
    <option value="" ${selectedLevel === null ? "selected" : ""}>No access</option>
    ${optionMarkup}
  `;
}

function formatPermissionsSummary(permissions) {
  const boardsSummary =
    permissions?.boards?.scope === "all"
      ? `Boards ${permissions.boards.level ?? "none"}`
      : `Boards ${permissions?.boards?.grants?.length ?? 0}`;
  const signalsSummary = `Intake ${permissions?.signals ?? "none"}`;
  const documentsSummary = `Documents ${permissions?.documents ?? "none"}`;

  return `${boardsSummary}, ${signalsSummary}, ${documentsSummary}`;
}

function renderWebhookStatusToken(status) {
  const classes = {
    Active: "token token-ok",
    Paused: "token token-warn",
  };

  return `<span class="${classes[status] ?? "token"}">${escapeHtml(status)}</span>`;
}

function formatWebhookEventSummary(subscribedEvents) {
  if (!Array.isArray(subscribedEvents) || subscribedEvents.length === 0) {
    return "No subscriptions";
  }

  return subscribedEvents.join(", ");
}

function formatWebhookScope(webhook) {
  if (!webhook?.spaceId) {
    return "All spaces";
  }

  const space = state.snapshot.spaces.find((entry) => entry.id === webhook.spaceId);
  return space ? space.name : "Scoped space";
}

function describeWebhookEventType(eventType) {
  const descriptions = {
    "work-item.*": "Every operational work-item event.",
    "work-item.created": "New work captured into a space.",
    "work-item.updated": "Edits that do not change workflow state.",
    "state.changed": "Workflow state transitions for work items.",
    "signal.*": "All shared intake events.",
    "signal.created": "A new signal entered shared intake.",
    "signal.updated": "An existing signal changed.",
    "signal.pulled": "A signal was pulled into a space as work.",
    "document.*": "All document creation and editorial changes.",
    "document.created": "A document was created from work or directly.",
    "document.updated": "A document was edited.",
  };

  return descriptions[eventType] ?? "Deliver this event type.";
}

function capitalizeAccessLevel(level) {
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : "";
}

function formatLastUsed(value) {
  return value ? formatDateTime(value) : "Never";
}

function formatTokenIssued(value) {
  return value ? formatDateTime(value) : "Never";
}

function formatUserLastSignIn(value) {
  return value ? formatDateTime(value) : "Never";
}
