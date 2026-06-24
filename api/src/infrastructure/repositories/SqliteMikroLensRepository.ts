import type {
  LedgerData,
  MikroLensRepository as MikroLensRepositoryPort,
} from "../../application/ports/MikroLensRepository.ts";
import type { WorkItemFilters } from "../../application/queries/WorkItemFilters.ts";
import type { SavedView } from "../../application/readModels/SavedView.ts";
import type { AccessPolicy } from "../../domain/AccessPolicy.ts";
import {
  createDefaultApiIdentityAccessPolicy,
  createDefaultUserAccessPolicy,
  isAccessLevel,
} from "../../domain/AccessPolicy.ts";
import type { ActivityEntityType, ActivityEvent } from "../../domain/Activity.ts";
import type { ApiIdentityDTO } from "../../domain/ApiIdentity.ts";
import type { DocumentDTO, DocumentLink } from "../../domain/Document.ts";
import type { HorizonDefaultDTO, HorizonDTO, HorizonKey } from "../../domain/Horizon.ts";
import type { MagicLink } from "../../domain/MagicLink.ts";
import type { SignalDTO } from "../../domain/Signal.ts";
import type { SpaceDTO } from "../../domain/Space.ts";
import type { UserDTO } from "../../domain/User.ts";
import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventEnvelope,
} from "../../domain/Webhook.ts";
import type { WorkItemDTO } from "../../domain/WorkItem.ts";
import type { MikroLensDatabase } from "../database/MikroLensDatabase.ts";
import { generateId } from "../utils/id.ts";

interface SpaceRow {
  accent: string;
  created_at: string;
  description: string;
  id: string;
  name: string;
  updated_at: string;
}

interface HorizonRow {
  created_at: string;
  description: string;
  description_override: string | null;
  id: string;
  key: string | null;
  label: string;
  label_override: string | null;
  name: string;
  order_index: number;
  space_id: string;
  timeframe_text_override: string | null;
  updated_at: string;
  window_end_days: number;
  window_start_days: number;
}

interface HorizonDefaultRow {
  created_at: string;
  description: string;
  key: string;
  label: string;
  order_index: number;
  timeframe_text: string;
  updated_at: string;
}

interface WorkItemRow {
  blocked_reason: string;
  completed_at: string | null;
  created_at: string;
  horizon_id: string;
  id: string;
  last_touched_at: string;
  owner_name: string | null;
  owner_user_ids_json: string;
  ref: string;
  roadmap_relevance: number;
  source: "planned" | "unplanned";
  space_id: string;
  state: WorkItemDTO["state"];
  summary: string;
  target_end_date: string | null;
  target_start_date: string | null;
  title: string;
  type: WorkItemDTO["type"];
  updated_at: string;
}

interface SignalRow {
  created_at: string;
  expected_timeline: string | null;
  id: string;
  pulled_at: string | null;
  pulled_into_work_item_id: string | null;
  ref: string;
  status: SignalDTO["status"];
  source: string;
  summary: string;
  title: string;
  updated_at: string;
  urgency: SignalDTO["urgency"];
}

interface DocumentRow {
  created_at: string;
  curated: number;
  horizon_id: string | null;
  id: string;
  markdown: string;
  roadmap_relevance: number;
  space_id: string | null;
  summary: string;
  title: string;
  type: DocumentDTO["type"];
  updated_at: string;
}

interface DocumentLinkRow {
  document_id: string;
  document_section: string;
  id: string;
  relation: string;
  work_item_id: string;
}

interface SavedViewRow {
  accent: string;
  created_at: string;
  description: string;
  filters_json: string;
  id: string;
  name: string;
  scope: SavedView["scope"];
  updated_at: string;
}

interface ApiIdentityRow {
  created_at: string;
  description: string;
  id: string;
  key: string;
  last_used_at: string | null;
  name: string;
  permissions_json: string | null;
  status: ApiIdentityDTO["status"];
  token_hash: string | null;
  token_last_rotated_at: string | null;
  updated_at: string;
}

interface ActivityRow {
  action: string;
  created_at: string;
  entity_id: string;
  entity_type: ActivityEvent["entityType"];
  id: string;
  metadata_json: string;
  summary: string;
}

interface UserRow {
  activated_at: string | null;
  created_at: string;
  email: string;
  id: string;
  invited_at: string;
  last_signed_in_at: string | null;
  name: string | null;
  permissions_json: string | null;
  role: UserDTO["role"];
  status: UserDTO["status"];
  updated_at: string;
}

interface MagicLinkRow {
  created_at: string;
  email: string;
  expires_at: string;
  id: string;
  purpose: MagicLink["purpose"];
  token_hash: string;
  used_at: string | null;
  user_id: string;
}

interface WebhookEndpointRow {
  created_at: string;
  id: string;
  name: string;
  secret: string;
  space_id: string | null;
  status: WebhookEndpoint["status"];
  subscribed_events_json: string;
  updated_at: string;
  url: string;
}

interface WebhookDeliveryRow {
  attempt_count: number;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at: string;
  delivered_at: string | null;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  id: string;
  last_error: string | null;
  next_attempt_at: string;
  payload_json: string;
  status: WebhookDelivery["status"];
}

/**
 * @description SQLite-backed repository adapter for MikroLens's ledger objects.
 */
export class SqliteMikroLensRepository implements MikroLensRepositoryPort {
  private readonly database: MikroLensDatabase;

  constructor(database: MikroLensDatabase) {
    this.database = database;
  }

  /**
   * @description Return the full ledger used by the API's aggregate views.
   */
  getLedger(): LedgerData {
    return {
      activity: this.listActivity(),
      apiIdentities: this.listApiIdentities(),
      documentLinks: this.listDocumentLinks(),
      documents: this.listDocuments(),
      horizons: this.listHorizons(),
      horizonDefaults: this.listHorizonDefaults(),
      signals: this.listSignals(),
      spaces: this.listSpaces(),
      users: this.listUsers(),
      views: this.listViews(),
      webhooks: this.listWebhookEndpoints(),
      workItems: this.listWorkItems(),
    };
  }

  /**
   * @description List spaces ordered for stable rendering.
   */
  listSpaces(): SpaceDTO[] {
    return this.database.all<SpaceRow>("SELECT * FROM spaces ORDER BY name ASC").map((row) => ({
      accent: row.accent,
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * @description Return a single space when it exists.
   */
  getSpace(id: string): SpaceDTO | null {
    const row = this.database.get<SpaceRow>("SELECT * FROM spaces WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      accent: row.accent,
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Insert or replace a space.
   */
  saveSpace(space: SpaceDTO): void {
    this.database.run(
      `
        INSERT INTO spaces (id, name, description, accent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          accent = excluded.accent,
          updated_at = excluded.updated_at
      `,
      space.id,
      space.name,
      space.description,
      space.accent,
      space.createdAt,
      space.updatedAt,
    );
  }

  /**
   * @description List organization-level Horizon defaults in stable order.
   */
  listHorizonDefaults(): HorizonDefaultDTO[] {
    return this.database
      .all<HorizonDefaultRow>("SELECT * FROM horizon_defaults ORDER BY order_index ASC")
      .map((row) => this.hydrateHorizonDefaultRow(row));
  }

  /**
   * @description Return a single Horizon default if present.
   */
  getHorizonDefault(key: string): HorizonDefaultDTO | null {
    const row = this.database.get<HorizonDefaultRow>(
      "SELECT * FROM horizon_defaults WHERE key = ?",
      key,
    );

    if (!row) {
      return null;
    }

    return this.hydrateHorizonDefaultRow(row);
  }

  /**
   * @description Insert or replace an organization-level Horizon default.
   */
  saveHorizonDefault(horizonDefault: HorizonDefaultDTO): void {
    this.database.run(
      `
        INSERT INTO horizon_defaults (
          key, label, order_index, description, timeframe_text, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          label = excluded.label,
          order_index = excluded.order_index,
          description = excluded.description,
          timeframe_text = excluded.timeframe_text,
          updated_at = excluded.updated_at
      `,
      horizonDefault.key,
      horizonDefault.label,
      horizonDefault.orderIndex,
      horizonDefault.description,
      horizonDefault.timeframeText,
      horizonDefault.createdAt,
      horizonDefault.updatedAt,
    );
  }

  /**
   * @description List all horizons ordered by space and horizon order.
   */
  listHorizons(): HorizonDTO[] {
    const defaultsByKey = this.getHorizonDefaultsByKey();

    return this.database
      .all<HorizonRow>("SELECT * FROM horizons ORDER BY space_id ASC, order_index ASC")
      .map((row) => this.resolveHorizonRow(row, defaultsByKey));
  }

  /**
   * @description Return a single horizon if present.
   */
  getHorizon(id: string): HorizonDTO | null {
    const row = this.database.get<HorizonRow>("SELECT * FROM horizons WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return this.resolveHorizonRow(row, this.getHorizonDefaultsByKey());
  }

  /**
   * @description Insert or replace a horizon.
   */
  saveHorizon(horizon: HorizonDTO): void {
    this.database.run(
      `
        INSERT INTO horizons (
          id, space_id, name, label, order_index, window_start_days,
          window_end_days, description, created_at, updated_at,
          key, label_override, description_override, timeframe_text_override
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          space_id = excluded.space_id,
          name = excluded.name,
          label = excluded.label,
          order_index = excluded.order_index,
          window_start_days = excluded.window_start_days,
          window_end_days = excluded.window_end_days,
          description = excluded.description,
          key = excluded.key,
          label_override = excluded.label_override,
          description_override = excluded.description_override,
          timeframe_text_override = excluded.timeframe_text_override,
          updated_at = excluded.updated_at
      `,
      horizon.id,
      horizon.spaceId,
      horizon.key,
      horizon.label,
      horizon.orderIndex,
      0,
      0,
      horizon.description,
      horizon.createdAt,
      horizon.updatedAt,
      horizon.key,
      horizon.labelOverride,
      horizon.descriptionOverride,
      horizon.timeframeTextOverride,
    );
  }

  private hydrateHorizonDefaultRow(row: HorizonDefaultRow): HorizonDefaultDTO {
    return {
      createdAt: row.created_at,
      description: row.description,
      key: row.key as HorizonKey,
      label: row.label,
      orderIndex: row.order_index,
      timeframeText: row.timeframe_text,
      updatedAt: row.updated_at,
    };
  }

  private getHorizonDefaultsByKey(): Map<HorizonKey, HorizonDefaultDTO> {
    return new Map(
      this.listHorizonDefaults().map((horizonDefault) => [horizonDefault.key, horizonDefault]),
    );
  }

  private resolveHorizonRow(
    row: HorizonRow,
    defaultsByKey: Map<HorizonKey, HorizonDefaultDTO>,
  ): HorizonDTO {
    const key = this.resolveHorizonKey(row);
    const defaults = defaultsByKey.get(key);
    const label = row.label_override ?? defaults?.label ?? row.label;
    const description = row.description_override ?? defaults?.description ?? row.description;
    const timeframeText = row.timeframe_text_override ?? defaults?.timeframeText ?? "";

    return {
      createdAt: row.created_at,
      description,
      descriptionOverride: row.description_override,
      id: row.id,
      inheritsDefault:
        row.label_override === null &&
        row.description_override === null &&
        row.timeframe_text_override === null,
      key,
      label,
      labelOverride: row.label_override,
      name: label,
      orderIndex: defaults?.orderIndex ?? row.order_index,
      spaceId: row.space_id,
      timeframeText,
      timeframeTextOverride: row.timeframe_text_override,
      updatedAt: row.updated_at,
    };
  }

  private resolveHorizonKey(row: Pick<HorizonRow, "key" | "name" | "order_index">): HorizonKey {
    if (row.key === "horizon_1" || row.key === "horizon_2" || row.key === "horizon_3") {
      return row.key;
    }

    if (row.name === "Now") {
      return "horizon_1";
    }

    if (row.name === "Next") {
      return "horizon_2";
    }

    if (row.name === "Later") {
      return "horizon_3";
    }

    return (["horizon_1", "horizon_2", "horizon_3"][row.order_index] ?? "horizon_3") as HorizonKey;
  }

  /**
   * @description List all work items ordered by most recent operational change.
   */
  listWorkItems(): WorkItemDTO[] {
    return this.database
      .all<WorkItemRow>("SELECT * FROM work_items ORDER BY updated_at DESC, ref ASC")
      .map((row) => ({
        blockedReason: row.blocked_reason,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        horizonId: row.horizon_id,
        id: row.id,
        lastTouchedAt: row.last_touched_at,
        ownerName: row.owner_name,
        ownerUserIds: parseStringArray(row.owner_user_ids_json),
        ref: row.ref,
        roadmapRelevance: Boolean(row.roadmap_relevance),
        source: row.source,
        spaceId: row.space_id,
        state: row.state,
        summary: row.summary,
        targetEndDate: row.target_end_date,
        targetStartDate: row.target_start_date,
        title: row.title,
        type: row.type,
        updatedAt: row.updated_at,
      }));
  }

  /**
   * @description Return a single work item if it exists.
   */
  getWorkItem(id: string): WorkItemDTO | null {
    const row = this.database.get<WorkItemRow>("SELECT * FROM work_items WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      blockedReason: row.blocked_reason,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      horizonId: row.horizon_id,
      id: row.id,
      lastTouchedAt: row.last_touched_at,
      ownerName: row.owner_name,
      ownerUserIds: parseStringArray(row.owner_user_ids_json),
      ref: row.ref,
      roadmapRelevance: Boolean(row.roadmap_relevance),
      source: row.source,
      spaceId: row.space_id,
      state: row.state,
      summary: row.summary,
      targetEndDate: row.target_end_date,
      targetStartDate: row.target_start_date,
      title: row.title,
      type: row.type,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Insert or replace a work item.
   */
  saveWorkItem(workItem: WorkItemDTO): void {
    this.database.run(
      `
        INSERT INTO work_items (
          id, ref, space_id, type, title, summary, state, horizon_id,
          owner_name, owner_user_ids_json, target_start_date, target_end_date, source, blocked_reason,
          roadmap_relevance, created_at, updated_at, last_touched_at, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ref = excluded.ref,
          space_id = excluded.space_id,
          type = excluded.type,
          title = excluded.title,
          summary = excluded.summary,
          state = excluded.state,
          horizon_id = excluded.horizon_id,
          owner_name = excluded.owner_name,
          owner_user_ids_json = excluded.owner_user_ids_json,
          target_start_date = excluded.target_start_date,
          target_end_date = excluded.target_end_date,
          source = excluded.source,
          blocked_reason = excluded.blocked_reason,
          roadmap_relevance = excluded.roadmap_relevance,
          updated_at = excluded.updated_at,
          last_touched_at = excluded.last_touched_at,
          completed_at = excluded.completed_at
      `,
      workItem.id,
      workItem.ref,
      workItem.spaceId,
      workItem.type,
      workItem.title,
      workItem.summary,
      workItem.state,
      workItem.horizonId,
      workItem.ownerName,
      JSON.stringify(workItem.ownerUserIds),
      workItem.targetStartDate,
      workItem.targetEndDate,
      workItem.source,
      workItem.blockedReason,
      Number(workItem.roadmapRelevance),
      workItem.createdAt,
      workItem.updatedAt,
      workItem.lastTouchedAt,
      workItem.completedAt,
    );
  }

  /**
   * @description Delete a work item by id.
   */
  deleteWorkItem(id: string): void {
    this.database.run("DELETE FROM work_items WHERE id = ?", id);
  }

  /**
   * @description List signals ordered by freshest activity.
   */
  listSignals(): SignalDTO[] {
    return this.database
      .all<SignalRow>("SELECT * FROM signals ORDER BY updated_at DESC, ref ASC")
      .map((row) => ({
        createdAt: row.created_at,
        expectedTimeline: row.expected_timeline,
        id: row.id,
        pulledAt: row.pulled_at,
        pulledIntoWorkItemId: row.pulled_into_work_item_id,
        ref: row.ref,
        status: row.status,
        source: row.source,
        summary: row.summary,
        title: row.title,
        updatedAt: row.updated_at,
        urgency: row.urgency,
      }));
  }

  /**
   * @description Return a single signal when it exists.
   */
  getSignal(id: string): SignalDTO | null {
    const row = this.database.get<SignalRow>("SELECT * FROM signals WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      expectedTimeline: row.expected_timeline,
      id: row.id,
      pulledAt: row.pulled_at,
      pulledIntoWorkItemId: row.pulled_into_work_item_id,
      ref: row.ref,
      status: row.status,
      source: row.source,
      summary: row.summary,
      title: row.title,
      updatedAt: row.updated_at,
      urgency: row.urgency,
    };
  }

  /**
   * @description Insert or replace a signal.
   */
  saveSignal(signal: SignalDTO): void {
    this.database.run(
      `
        INSERT INTO signals (
          id, ref, title, summary, source, urgency, expected_timeline,
          status, created_at, updated_at, pulled_at, pulled_into_work_item_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ref = excluded.ref,
          title = excluded.title,
          summary = excluded.summary,
          source = excluded.source,
          urgency = excluded.urgency,
          expected_timeline = excluded.expected_timeline,
          status = excluded.status,
          updated_at = excluded.updated_at,
          pulled_at = excluded.pulled_at,
          pulled_into_work_item_id = excluded.pulled_into_work_item_id
      `,
      signal.id,
      signal.ref,
      signal.title,
      signal.summary,
      signal.source,
      signal.urgency,
      signal.expectedTimeline,
      signal.status,
      signal.createdAt,
      signal.updatedAt,
      signal.pulledAt,
      signal.pulledIntoWorkItemId,
    );
  }

  /**
   * @description Delete a signal by id.
   */
  deleteSignal(id: string): void {
    this.database.run("DELETE FROM signals WHERE id = ?", id);
  }

  /**
   * @description List all narrative documents ordered by last update.
   */
  listDocuments(): DocumentDTO[] {
    return this.database
      .all<DocumentRow>("SELECT * FROM documents ORDER BY updated_at DESC, title ASC")
      .map((row) => ({
        createdAt: row.created_at,
        horizonId: row.horizon_id,
        id: row.id,
        markdown: row.markdown,
        spaceId: row.space_id,
        summary: row.summary,
        title: row.title,
        type: row.type,
        updatedAt: row.updated_at,
      }));
  }

  /**
   * @description Return a single document by id if present.
   */
  getDocument(id: string): DocumentDTO | null {
    const row = this.database.get<DocumentRow>("SELECT * FROM documents WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      horizonId: row.horizon_id,
      id: row.id,
      markdown: row.markdown,
      spaceId: row.space_id,
      summary: row.summary,
      title: row.title,
      type: row.type,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Insert or replace a document.
   */
  saveDocument(document: DocumentDTO): void {
    this.database.run(
      `
        INSERT INTO documents (
          id, space_id, type, title, summary, markdown, horizon_id,
          roadmap_relevance, curated, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          space_id = excluded.space_id,
          type = excluded.type,
          title = excluded.title,
          summary = excluded.summary,
          markdown = excluded.markdown,
          horizon_id = excluded.horizon_id,
          roadmap_relevance = excluded.roadmap_relevance,
          curated = excluded.curated,
          updated_at = excluded.updated_at
      `,
      document.id,
      document.spaceId,
      document.type,
      document.title,
      document.summary,
      document.markdown,
      document.horizonId,
      0,
      0,
      document.createdAt,
      document.updatedAt,
    );
  }

  /**
   * @description Delete a document by id.
   */
  deleteDocument(id: string): void {
    this.database.run("DELETE FROM documents WHERE id = ?", id);
  }

  /**
   * @description Return the simple work-to-document links used across views.
   */
  listDocumentLinks(): DocumentLink[] {
    return this.database
      .all<DocumentLinkRow>("SELECT * FROM document_links ORDER BY id ASC")
      .map((row) => ({
        documentId: row.document_id,
        documentSection: row.document_section,
        id: row.id,
        relation: row.relation,
        workItemId: row.work_item_id,
      }));
  }

  /**
   * @description Insert a new work-to-document link.
   */
  saveDocumentLink(link: DocumentLink): void {
    this.database.run(
      `
        INSERT OR REPLACE INTO document_links (
          id, work_item_id, document_id, relation, document_section
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      link.id,
      link.workItemId,
      link.documentId,
      link.relation,
      link.documentSection,
    );
  }

  /**
   * @description Delete a specific work-to-document link.
   */
  deleteDocumentLink(workItemId: string, documentId: string): void {
    this.database.run(
      "DELETE FROM document_links WHERE work_item_id = ? AND document_id = ?",
      workItemId,
      documentId,
    );
  }

  /**
   * @description Delete all links for a work item.
   */
  deleteDocumentLinksForWorkItem(workItemId: string): void {
    this.database.run("DELETE FROM document_links WHERE work_item_id = ?", workItemId);
  }

  /**
   * @description Delete all links for a document.
   */
  deleteDocumentLinksForDocument(documentId: string): void {
    this.database.run("DELETE FROM document_links WHERE document_id = ?", documentId);
  }

  /**
   * @description List all saved views.
   */
  listViews(): SavedView[] {
    return this.database
      .all<SavedViewRow>("SELECT * FROM views ORDER BY scope ASC, name ASC")
      .map((row) => ({
        accent: row.accent,
        createdAt: row.created_at,
        description: row.description,
        filters: JSON.parse(row.filters_json) as WorkItemFilters,
        id: row.id,
        name: row.name,
        scope: row.scope,
        updatedAt: row.updated_at,
      }));
  }

  /**
   * @description List all API identities ordered for settings and audit views.
   */
  listApiIdentities(): ApiIdentityDTO[] {
    return this.database
      .all<ApiIdentityRow>("SELECT * FROM api_identities ORDER BY name ASC, key ASC")
      .map((row) => ({
        createdAt: row.created_at,
        description: row.description,
        id: row.id,
        lastUsedAt: row.last_used_at,
        name: row.name,
        permissions: parseAccessPolicyJson(
          row.permissions_json,
          createDefaultApiIdentityAccessPolicy(),
        ),
        status: row.status,
        tokenLastRotatedAt: row.token_last_rotated_at,
        updatedAt: row.updated_at,
      }));
  }

  /**
   * @description Return a single API identity by id when it exists.
   */
  getApiIdentity(id: string): ApiIdentityDTO | null {
    const row = this.database.get<ApiIdentityRow>("SELECT * FROM api_identities WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      lastUsedAt: row.last_used_at,
      name: row.name,
      permissions: parseAccessPolicyJson(
        row.permissions_json,
        createDefaultApiIdentityAccessPolicy(),
      ),
      status: row.status,
      tokenLastRotatedAt: row.token_last_rotated_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Insert or replace an API identity.
   */
  saveApiIdentity(identity: ApiIdentityDTO): void {
    this.database.run(
      `
        INSERT INTO api_identities (
          id, key, name, description, permissions_json, status, last_used_at,
          token_last_rotated_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          key = excluded.key,
          name = excluded.name,
          description = excluded.description,
          permissions_json = excluded.permissions_json,
          status = excluded.status,
          last_used_at = excluded.last_used_at,
          token_last_rotated_at = excluded.token_last_rotated_at,
          updated_at = excluded.updated_at
      `,
      identity.id,
      identity.id,
      identity.name,
      identity.description,
      JSON.stringify(identity.permissions),
      identity.status,
      identity.lastUsedAt,
      identity.tokenLastRotatedAt,
      identity.createdAt,
      identity.updatedAt,
    );
  }

  /**
   * @description Replace the hashed bearer token stored for an API identity.
   */
  replaceApiIdentityToken(apiIdentityId: string, tokenHash: string, rotatedAt: string): void {
    this.database.run(
      `
        UPDATE api_identities
        SET token_hash = ?, token_last_rotated_at = ?, updated_at = ?
        WHERE id = ?
      `,
      tokenHash,
      rotatedAt,
      rotatedAt,
      apiIdentityId,
    );
  }

  /**
   * @description Return the API identity matching a hashed bearer token.
   */
  findApiIdentityByTokenHash(tokenHash: string): ApiIdentityDTO | null {
    const row = this.database.get<ApiIdentityRow>(
      "SELECT * FROM api_identities WHERE token_hash = ?",
      tokenHash,
    );

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      lastUsedAt: row.last_used_at,
      name: row.name,
      permissions: parseAccessPolicyJson(
        row.permissions_json,
        createDefaultApiIdentityAccessPolicy(),
      ),
      status: row.status,
      tokenLastRotatedAt: row.token_last_rotated_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Persist an activity event for the recent-changes feed.
   */
  saveActivity(event: ActivityEvent): void {
    this.database.run(
      `
        INSERT OR REPLACE INTO activity_log (
          id, entity_type, entity_id, action, summary, created_at, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      event.id,
      event.entityType,
      event.entityId,
      event.action,
      event.summary,
      event.createdAt,
      JSON.stringify(event.metadata),
    );
  }

  /**
   * @description Delete activity rows for a single entity.
   */
  deleteActivityForEntity(entityType: ActivityEntityType, entityId: string): void {
    this.database.run(
      "DELETE FROM activity_log WHERE entity_type = ? AND entity_id = ?",
      entityType,
      entityId,
    );
  }

  /**
   * @description Return recent changes in reverse chronological order.
   */
  listActivity(limit = 24): ActivityEvent[] {
    return this.database
      .all<ActivityRow>("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", limit)
      .map((row) => ({
        action: row.action,
        createdAt: row.created_at,
        entityId: row.entity_id,
        entityType: row.entity_type,
        id: row.id,
        metadata: JSON.parse(row.metadata_json) as ActivityEvent["metadata"],
        summary: row.summary,
      }));
  }

  /**
   * @description List webhook endpoints ordered for settings and delivery fanout.
   */
  listWebhookEndpoints(): WebhookEndpoint[] {
    return this.database
      .all<WebhookEndpointRow>("SELECT * FROM webhook_endpoints ORDER BY name ASC, created_at ASC")
      .map((row) => ({
        createdAt: row.created_at,
        id: row.id,
        name: row.name,
        secret: row.secret,
        spaceId: row.space_id,
        status: row.status,
        subscribedEvents: JSON.parse(row.subscribed_events_json) as string[],
        updatedAt: row.updated_at,
        url: row.url,
      }));
  }

  /**
   * @description Return a single webhook endpoint by id when it exists.
   */
  getWebhookEndpoint(id: string): WebhookEndpoint | null {
    const row = this.database.get<WebhookEndpointRow>(
      "SELECT * FROM webhook_endpoints WHERE id = ?",
      id,
    );

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      id: row.id,
      name: row.name,
      secret: row.secret,
      spaceId: row.space_id,
      status: row.status,
      subscribedEvents: JSON.parse(row.subscribed_events_json) as string[],
      updatedAt: row.updated_at,
      url: row.url,
    };
  }

  /**
   * @description Insert or replace a webhook endpoint.
   */
  saveWebhookEndpoint(endpoint: WebhookEndpoint): void {
    this.database.run(
      `
        INSERT INTO webhook_endpoints (
          id, name, url, secret, status, space_id, subscribed_events_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          url = excluded.url,
          secret = excluded.secret,
          status = excluded.status,
          space_id = excluded.space_id,
          subscribed_events_json = excluded.subscribed_events_json,
          updated_at = excluded.updated_at
      `,
      endpoint.id,
      endpoint.name,
      endpoint.url,
      endpoint.secret,
      endpoint.status,
      endpoint.spaceId,
      JSON.stringify(endpoint.subscribedEvents),
      endpoint.createdAt,
      endpoint.updatedAt,
    );
  }

  /**
   * @description Delete a webhook endpoint and any dependent deliveries.
   */
  deleteWebhookEndpoint(id: string): void {
    this.database.run("DELETE FROM webhook_endpoints WHERE id = ?", id);
  }

  /**
   * @description Return recent deliveries for a single endpoint.
   */
  listWebhookDeliveries(endpointId: string, limit = 50): WebhookDelivery[] {
    return this.database
      .all<WebhookDeliveryRow>(
        `
          SELECT *
          FROM webhook_deliveries
          WHERE endpoint_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `,
        endpointId,
        limit,
      )
      .map((row) => this.mapWebhookDelivery(row));
  }

  /**
   * @description Persist delivery rows for all webhook endpoints subscribed to an activity.
   */
  enqueueWebhookDeliveries(activity: ActivityEvent): void {
    const payload = this.buildWebhookEventEnvelope(activity);
    const endpoints = this.listWebhookEndpoints().filter(
      (endpoint) =>
        endpoint.status === "Active" &&
        matchesWebhookEvent(endpoint.subscribedEvents, activity.action) &&
        (!endpoint.spaceId || endpoint.spaceId === payload.spaceId),
    );

    for (const endpoint of endpoints) {
      this.database.run(
        `
          INSERT OR IGNORE INTO webhook_deliveries (
            id, endpoint_id, event_id, event_type, payload_json, status, attempt_count,
            next_attempt_at, claimed_at, claimed_by, last_error, created_at, delivered_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        generateId(),
        endpoint.id,
        activity.id,
        activity.action,
        JSON.stringify(payload),
        "pending",
        0,
        activity.createdAt,
        null,
        null,
        null,
        activity.createdAt,
        null,
      );
    }
  }

  /**
   * @description Reset stale in-flight claims so another worker can retry them.
   */
  releaseStaleWebhookClaims(staleBefore: string): void {
    this.database.run(
      `
        UPDATE webhook_deliveries
        SET status = 'pending', claimed_at = NULL, claimed_by = NULL
        WHERE status = 'processing' AND claimed_at IS NOT NULL AND claimed_at < ?
      `,
      staleBefore,
    );
  }

  /**
   * @description Claim a batch of due webhook deliveries for a worker.
   */
  claimPendingWebhookDeliveries(workerId: string, now: string, limit: number): WebhookDelivery[] {
    return this.database
      .all<WebhookDeliveryRow>(
        `
          WITH due AS (
            SELECT id
            FROM webhook_deliveries
            WHERE status = 'pending' AND next_attempt_at <= ?
            ORDER BY next_attempt_at ASC, created_at ASC
            LIMIT ?
          )
          UPDATE webhook_deliveries
          SET status = 'processing', claimed_at = ?, claimed_by = ?
          WHERE id IN (SELECT id FROM due)
          RETURNING *
        `,
        now,
        limit,
        now,
        workerId,
      )
      .map((row) => this.mapWebhookDelivery(row));
  }

  /**
   * @description Mark a webhook delivery as completed successfully.
   */
  markWebhookDeliveryDelivered(id: string, deliveredAt: string, attemptCount: number): void {
    this.database.run(
      `
        UPDATE webhook_deliveries
        SET
          status = 'delivered',
          attempt_count = ?,
          claimed_at = NULL,
          claimed_by = NULL,
          delivered_at = ?,
          last_error = NULL
        WHERE id = ?
      `,
      attemptCount,
      deliveredAt,
      id,
    );
  }

  /**
   * @description Schedule another delivery attempt after a recoverable failure.
   */
  rescheduleWebhookDelivery(
    id: string,
    nextAttemptAt: string,
    error: string,
    attemptCount: number,
  ): void {
    this.database.run(
      `
        UPDATE webhook_deliveries
        SET
          status = 'pending',
          attempt_count = ?,
          next_attempt_at = ?,
          claimed_at = NULL,
          claimed_by = NULL,
          last_error = ?,
          delivered_at = NULL
        WHERE id = ?
      `,
      attemptCount,
      nextAttemptAt,
      error,
      id,
    );
  }

  /**
   * @description Mark a webhook delivery as permanently failed.
   */
  failWebhookDelivery(id: string, error: string, attemptCount: number): void {
    this.database.run(
      `
        UPDATE webhook_deliveries
        SET
          status = 'failed',
          attempt_count = ?,
          claimed_at = NULL,
          claimed_by = NULL,
          last_error = ?
        WHERE id = ?
      `,
      attemptCount,
      error,
      id,
    );
  }

  /**
   * @description List users ordered for settings and access review.
   */
  listUsers(): UserDTO[] {
    return this.database
      .all<UserRow>(
        `
          SELECT *
          FROM users
          ORDER BY
            CASE role WHEN 'Admin' THEN 0 ELSE 1 END ASC,
            email ASC
        `,
      )
      .map((row) => ({
        activatedAt: row.activated_at,
        createdAt: row.created_at,
        email: row.email,
        id: row.id,
        invitedAt: row.invited_at,
        lastSignedInAt: row.last_signed_in_at,
        name: row.name,
        permissions: parseAccessPolicyJson(
          row.permissions_json,
          createDefaultUserAccessPolicy(row.role),
        ),
        role: row.role,
        status: row.status,
        updatedAt: row.updated_at,
      }));
  }

  /**
   * @description Return a single user when it exists.
   */
  getUser(id: string): UserDTO | null {
    const row = this.database.get<UserRow>("SELECT * FROM users WHERE id = ?", id);

    if (!row) {
      return null;
    }

    return {
      activatedAt: row.activated_at,
      createdAt: row.created_at,
      email: row.email,
      id: row.id,
      invitedAt: row.invited_at,
      lastSignedInAt: row.last_signed_in_at,
      name: row.name,
      permissions: parseAccessPolicyJson(
        row.permissions_json,
        createDefaultUserAccessPolicy(row.role),
      ),
      role: row.role,
      status: row.status,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Return a single user matched by normalized email.
   */
  getUserByEmail(email: string): UserDTO | null {
    const row = this.database.get<UserRow>("SELECT * FROM users WHERE email = ?", email);

    if (!row) {
      return null;
    }

    return {
      activatedAt: row.activated_at,
      createdAt: row.created_at,
      email: row.email,
      id: row.id,
      invitedAt: row.invited_at,
      lastSignedInAt: row.last_signed_in_at,
      name: row.name,
      permissions: parseAccessPolicyJson(
        row.permissions_json,
        createDefaultUserAccessPolicy(row.role),
      ),
      role: row.role,
      status: row.status,
      updatedAt: row.updated_at,
    };
  }

  /**
   * @description Insert or replace a user.
   */
  saveUser(user: UserDTO): void {
    this.database.run(
      `
        INSERT INTO users (
          id, email, name, role, permissions_json, status, invited_at,
          activated_at, last_signed_in_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          name = excluded.name,
          role = excluded.role,
          permissions_json = excluded.permissions_json,
          status = excluded.status,
          invited_at = excluded.invited_at,
          activated_at = excluded.activated_at,
          last_signed_in_at = excluded.last_signed_in_at,
          updated_at = excluded.updated_at
      `,
      user.id,
      user.email,
      user.name,
      user.role,
      JSON.stringify(user.permissions),
      user.status,
      user.invitedAt,
      user.activatedAt,
      user.lastSignedInAt,
      user.createdAt,
      user.updatedAt,
    );
  }

  /**
   * @description Delete a user and any dependent magic links.
   */
  deleteUser(id: string): void {
    this.database.run("DELETE FROM users WHERE id = ?", id);
  }

  /**
   * @description Run a repository operation inside a single transaction.
   */
  transaction<T>(operation: () => T): T {
    return this.database.transaction(operation);
  }

  /**
   * @description Persist a single-use magic link.
   */
  saveMagicLink(link: MagicLink): void {
    this.database.run(
      `
        INSERT INTO magic_links (
          id, user_id, email, token_hash, purpose, expires_at, used_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      link.id,
      link.userId,
      link.email,
      link.tokenHash,
      link.purpose,
      link.expiresAt,
      link.usedAt,
      link.createdAt,
    );
  }

  /**
   * @description Return the stored magic link matching a hashed token.
   */
  getMagicLinkByTokenHash(tokenHash: string): MagicLink | null {
    const row = this.database.get<MagicLinkRow>(
      "SELECT * FROM magic_links WHERE token_hash = ?",
      tokenHash,
    );

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      email: row.email,
      expiresAt: row.expires_at,
      id: row.id,
      purpose: row.purpose,
      tokenHash: row.token_hash,
      usedAt: row.used_at,
      userId: row.user_id,
    };
  }

  /**
   * @description Mark any existing unused magic links for a user as no longer valid.
   */
  revokeActiveMagicLinksForUser(userId: string, revokedAt: string): void {
    this.database.run(
      `
        UPDATE magic_links
        SET used_at = ?
        WHERE user_id = ? AND used_at IS NULL
      `,
      revokedAt,
      userId,
    );
  }

  /**
   * @description Mark a magic link as consumed.
   */
  markMagicLinkUsed(id: string, usedAt: string): void {
    this.database.run(
      `
        UPDATE magic_links
        SET used_at = ?
        WHERE id = ?
      `,
      usedAt,
      id,
    );
  }

  /**
   * @description Delete a stored magic link.
   */
  deleteMagicLink(id: string): void {
    this.database.run("DELETE FROM magic_links WHERE id = ?", id);
  }

  private buildWebhookEventEnvelope(activity: ActivityEvent): WebhookEventEnvelope {
    const workItem =
      activity.entityType === "work-item" ? this.getWorkItem(activity.entityId) : null;
    const signal = activity.entityType === "signal" ? this.getSignal(activity.entityId) : null;
    const document =
      activity.entityType === "document" ? this.getDocument(activity.entityId) : null;
    const pulledWorkItem = signal?.pulledIntoWorkItemId
      ? this.getWorkItem(signal.pulledIntoWorkItemId)
      : null;

    return {
      data: {
        activity: activity.metadata,
        ...(activity.entityType === "document" ? { document } : {}),
        ...(activity.entityType === "signal" ? { signal: signal } : {}),
        ...(activity.entityType === "work-item" ? { workItem } : {}),
      },
      entityId: activity.entityId,
      entityType: activity.entityType,
      id: activity.id,
      occurredAt: activity.createdAt,
      spaceId: workItem?.spaceId ?? document?.spaceId ?? pulledWorkItem?.spaceId ?? null,
      type: activity.action,
    };
  }

  private mapWebhookDelivery(row: WebhookDeliveryRow): WebhookDelivery {
    return {
      attemptCount: row.attempt_count,
      claimedAt: row.claimed_at,
      claimedBy: row.claimed_by,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      endpointId: row.endpoint_id,
      eventId: row.event_id,
      eventType: row.event_type,
      id: row.id,
      lastError: row.last_error,
      nextAttemptAt: row.next_attempt_at,
      payload: JSON.parse(row.payload_json) as WebhookEventEnvelope,
      status: row.status,
    };
  }
}

function matchesWebhookEvent(patterns: string[], eventType: string): boolean {
  return patterns.some((pattern) => {
    if (pattern === "*") {
      return true;
    }

    if (pattern.endsWith(".*")) {
      return eventType.startsWith(`${pattern.slice(0, -2)}.`);
    }

    return pattern === eventType;
  });
}

function parseAccessPolicyJson(value: string | null, fallback: AccessPolicy): AccessPolicy {
  if (!value) {
    return fallback;
  }

  try {
    return coerceAccessPolicy(JSON.parse(value), fallback);
  } catch {
    return fallback;
  }
}

function coerceAccessPolicy(value: unknown, fallback: AccessPolicy): AccessPolicy {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    boards: coerceBoardAccess(record.boards, fallback.boards),
    documents: coerceAccessLevelOrNull(record.documents, fallback.documents),
    signals: coerceAccessLevelOrNull(record.signals, fallback.signals),
  };
}

function coerceBoardAccess(
  value: unknown,
  fallback: AccessPolicy["boards"],
): AccessPolicy["boards"] {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  if (
    record.scope === "all" &&
    (record.level === null || (typeof record.level === "string" && isAccessLevel(record.level)))
  ) {
    return {
      level: record.level,
      scope: "all",
    };
  }

  if (record.scope !== "boards" || !Array.isArray(record.grants)) {
    return fallback;
  }

  const grants = record.grants
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const grant = entry as Record<string, unknown>;

      if (
        typeof grant.boardId !== "string" ||
        !grant.boardId.trim() ||
        typeof grant.level !== "string" ||
        !isAccessLevel(grant.level)
      ) {
        return null;
      }

      return {
        boardId: grant.boardId.trim(),
        level: grant.level,
      };
    })
    .filter((entry): entry is { boardId: string; level: "viewer" | "editor" | "admin" } =>
      Boolean(entry),
    );

  return {
    grants: Array.from(new Map(grants.map((grant) => [grant.boardId, grant])).values()).sort(
      (left, right) => left.boardId.localeCompare(right.boardId),
    ),
    scope: "boards",
  };
}

function coerceAccessLevelOrNull(
  value: unknown,
  fallback: AccessPolicy["documents"],
): AccessPolicy["documents"] {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && isAccessLevel(value) ? value : fallback;
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}
