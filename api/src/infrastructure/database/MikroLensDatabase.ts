import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { getBuiltInHorizonDefaults } from "../../domain/Horizon.ts";
import type { SeedData } from "../bootstrap/seedData.ts";

/**
 * @description Thin SQLite wrapper used for MikroLens's single-tenant ledger.
 */
export class MikroLensDatabase {
  readonly #database: DatabaseSync;
  readonly #filename: string;

  constructor(filename: string) {
    this.#filename = filename;

    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }

    this.#database = new DatabaseSync(filename);
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = NORMAL;
    `);
  }

  /**
   * @description Create the core schema and indexes if they do not already exist.
   */
  migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        accent TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS horizons (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        window_start_days INTEGER NOT NULL,
        window_end_days INTEGER NOT NULL,
        description TEXT NOT NULL,
        key TEXT NOT NULL,
        label_override TEXT,
        description_override TEXT,
        timeframe_text_override TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES spaces(id)
      );

      CREATE TABLE IF NOT EXISTS horizon_defaults (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        description TEXT NOT NULL,
        timeframe_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        ref TEXT NOT NULL UNIQUE,
        space_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        state TEXT NOT NULL,
        horizon_id TEXT NOT NULL,
        owner_name TEXT,
        owner_user_ids_json TEXT NOT NULL,
        target_start_date TEXT,
        target_end_date TEXT,
        source TEXT NOT NULL,
        blocked_reason TEXT NOT NULL,
        roadmap_relevance INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_touched_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (space_id) REFERENCES spaces(id),
        FOREIGN KEY (horizon_id) REFERENCES horizons(id)
      );

      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        ref TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        source TEXT NOT NULL,
        urgency TEXT NOT NULL,
        expected_timeline TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        pulled_at TEXT,
        pulled_into_work_item_id TEXT,
        FOREIGN KEY (pulled_into_work_item_id) REFERENCES work_items(id)
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        space_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        markdown TEXT NOT NULL,
        horizon_id TEXT,
        roadmap_relevance INTEGER NOT NULL,
        curated INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES spaces(id),
        FOREIGN KEY (horizon_id) REFERENCES horizons(id)
      );

      CREATE TABLE IF NOT EXISTS document_links (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        document_section TEXT NOT NULL,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id),
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );

      CREATE TABLE IF NOT EXISTS views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        scope TEXT NOT NULL,
        accent TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_identities (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        permissions_json TEXT,
        status TEXT NOT NULL,
        last_used_at TEXT,
        token_hash TEXT,
        token_last_rotated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        role TEXT NOT NULL,
        permissions_json TEXT,
        status TEXT NOT NULL,
        invited_at TEXT NOT NULL,
        activated_at TEXT,
        last_signed_in_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS magic_links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        purpose TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        status TEXT NOT NULL,
        space_id TEXT,
        subscribed_events_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_attempt_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
        UNIQUE(endpoint_id, event_id)
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_storage (
        storage_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS auth_storage_collections (
        collection_key TEXT NOT NULL,
        item TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (collection_key, item)
      );

      CREATE INDEX IF NOT EXISTS idx_horizons_space_order ON horizons(space_id, order_index);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_horizons_space_key ON horizons(space_id, key);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_horizon_defaults_key ON horizon_defaults(key);
      CREATE INDEX IF NOT EXISTS idx_work_items_space_state ON work_items(space_id, state);
      CREATE INDEX IF NOT EXISTS idx_work_items_horizon ON work_items(horizon_id);
      CREATE INDEX IF NOT EXISTS idx_work_items_last_touched ON work_items(last_touched_at);
      CREATE INDEX IF NOT EXISTS idx_signals_status_updated ON signals(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_space_type ON documents(space_id, type);
      CREATE INDEX IF NOT EXISTS idx_document_links_work_item ON document_links(work_item_id);
      CREATE INDEX IF NOT EXISTS idx_document_links_document ON document_links(document_id);
      CREATE INDEX IF NOT EXISTS idx_api_identities_status ON api_identities(status);
      CREATE INDEX IF NOT EXISTS idx_api_identities_last_used ON api_identities(last_used_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_magic_links_user ON magic_links(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links(expires_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_status_updated
        ON webhook_endpoints(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_next_attempt
        ON webhook_deliveries(status, next_attempt_at ASC);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created
        ON webhook_deliveries(endpoint_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_storage_expires_at ON auth_storage(expires_at);
      CREATE INDEX IF NOT EXISTS idx_auth_storage_collections_expires_at
        ON auth_storage_collections(expires_at);
      CREATE INDEX IF NOT EXISTS idx_auth_storage_collections_created_at
        ON auth_storage_collections(collection_key, created_at ASC);
    `);

    this.validateCurrentSchema();
  }

  /**
   * @description Verify that the database connection can execute a trivial query.
   */
  checkHealth(): boolean {
    try {
      const result = this.#database.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;
      return result?.ok === 1;
    } catch {
      return false;
    }
  }

  /**
   * @description Seed the shared Horizon defaults without adding any demo workspace content.
   */
  seedHorizonDefaultsIfEmpty(now = new Date().toISOString()): boolean {
    const existingDefaultCount = this.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM horizon_defaults",
    )?.count;

    if ((existingDefaultCount ?? 0) > 0) {
      return false;
    }

    for (const horizonDefault of getBuiltInHorizonDefaults(now)) {
      this.run(
        `
          INSERT OR IGNORE INTO horizon_defaults (
            key, label, order_index, description, timeframe_text, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
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

    return true;
  }

  /**
   * @description Seed the optional demo workspace once when a deployment explicitly opts in.
   */
  seedDemoDataIfEmpty(seedData: SeedData): boolean {
    const existingSpaceCount = this.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM spaces",
    )?.count;

    if ((existingSpaceCount ?? 0) > 0) {
      return false;
    }

    this.#database.exec("BEGIN");

    try {
      const defaultTimestamp = seedData.spaces[0]?.createdAt ?? new Date().toISOString();
      const horizonDefaults =
        seedData.horizonDefaults.length > 0
          ? seedData.horizonDefaults
          : getBuiltInHorizonDefaults(defaultTimestamp);

      for (const horizonDefault of horizonDefaults) {
        this.run(
          `
            INSERT OR IGNORE INTO horizon_defaults (
              key, label, order_index, description, timeframe_text, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
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

      for (const space of seedData.spaces) {
        this.run(
          `
            INSERT INTO spaces (id, name, description, accent, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          space.id,
          space.name,
          space.description,
          space.accent,
          space.createdAt,
          space.updatedAt,
        );
      }

      for (const horizon of seedData.horizons) {
        this.run(
          `
            INSERT INTO horizons (
              id, space_id, name, label, order_index, window_start_days,
              window_end_days, description, created_at, updated_at,
              key, label_override, description_override, timeframe_text_override
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          horizon.id,
          horizon.spaceId,
          horizon.name,
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

      for (const workItem of seedData.workItems) {
        this.run(
          `
            INSERT INTO work_items (
              id, ref, space_id, type, title, summary, state, horizon_id,
              owner_name, owner_user_ids_json, target_start_date, target_end_date, source, blocked_reason,
              roadmap_relevance, created_at, updated_at, last_touched_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      for (const document of seedData.documents) {
        this.run(
          `
            INSERT INTO documents (
              id, space_id, type, title, summary, markdown, horizon_id,
              roadmap_relevance, curated, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      for (const link of seedData.documentLinks) {
        this.run(
          `
            INSERT INTO document_links (id, work_item_id, document_id, relation, document_section)
            VALUES (?, ?, ?, ?, ?)
          `,
          link.id,
          link.workItemId,
          link.documentId,
          link.relation,
          link.documentSection,
        );
      }

      for (const view of seedData.views) {
        this.run(
          `
            INSERT INTO views (id, name, description, scope, accent, filters_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          view.id,
          view.name,
          view.description,
          view.scope,
          view.accent,
          JSON.stringify(view.filters),
          view.createdAt,
          view.updatedAt,
        );
      }

      for (const apiIdentity of seedData.apiIdentities) {
        this.run(
          `
            INSERT INTO api_identities (
              id, key, name, description, permissions_json, status, last_used_at,
              token_hash, token_last_rotated_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          apiIdentity.id,
          apiIdentity.id,
          apiIdentity.name,
          apiIdentity.description,
          JSON.stringify(apiIdentity.permissions),
          apiIdentity.status,
          apiIdentity.lastUsedAt,
          null,
          apiIdentity.tokenLastRotatedAt,
          apiIdentity.createdAt,
          apiIdentity.updatedAt,
        );
      }

      for (const user of seedData.users) {
        this.run(
          `
            INSERT INTO users (
              id, email, name, role, permissions_json, status, invited_at,
              activated_at, last_signed_in_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      for (const event of seedData.activity) {
        this.run(
          `
            INSERT INTO activity_log (
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

      this.#database.exec("COMMIT");
      return true;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * @description Run a statement and return all matching rows.
   */
  all<T>(sql: string, ...parameters: SQLInputValue[]): T[] {
    return this.#database.prepare(sql).all(...parameters) as T[];
  }

  /**
   * @description Run a statement and return the first matching row if present.
   */
  get<T>(sql: string, ...parameters: SQLInputValue[]): T | null {
    return (this.#database.prepare(sql).get(...parameters) as T | undefined) ?? null;
  }

  /**
   * @description Run a mutating statement.
   */
  run(sql: string, ...parameters: SQLInputValue[]): void {
    this.#database.prepare(sql).run(...parameters);
  }

  /**
   * @description Run a series of statements atomically.
   */
  transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN");

    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * @description Close the underlying SQLite connection.
   */
  close(): void {
    this.#database.close();
  }

  private validateCurrentSchema(): void {
    this.requireColumns("spaces", [
      "id",
      "name",
      "description",
      "accent",
      "created_at",
      "updated_at",
    ]);
    this.requireColumns("horizons", [
      "id",
      "space_id",
      "name",
      "label",
      "order_index",
      "description",
      "key",
      "label_override",
      "description_override",
      "timeframe_text_override",
      "created_at",
      "updated_at",
    ]);
    this.requireColumns("horizon_defaults", [
      "key",
      "label",
      "order_index",
      "description",
      "timeframe_text",
      "created_at",
      "updated_at",
    ]);
    this.requireColumns("work_items", [
      "id",
      "ref",
      "space_id",
      "type",
      "title",
      "summary",
      "state",
      "horizon_id",
      "owner_name",
      "owner_user_ids_json",
      "target_start_date",
      "target_end_date",
      "source",
      "blocked_reason",
      "roadmap_relevance",
      "created_at",
      "updated_at",
      "last_touched_at",
      "completed_at",
    ]);
    this.requireColumns("users", [
      "id",
      "email",
      "name",
      "role",
      "permissions_json",
      "status",
      "invited_at",
      "activated_at",
      "last_signed_in_at",
      "created_at",
      "updated_at",
    ]);
  }

  private requireColumns(tableName: string, expectedColumns: string[]): void {
    const columns = this.#database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
      name?: string;
    }>;
    const availableColumns = new Set(
      columns.map((column) => String(column.name ?? "").trim()).filter(Boolean),
    );
    const missingColumns = expectedColumns.filter((column) => !availableColumns.has(column));

    if (missingColumns.length === 0) {
      return;
    }

    const resetHint =
      this.#filename === ":memory:"
        ? "Recreate the test database before continuing."
        : `Delete ${this.#filename} and restart MikroLens so it can be recreated with the current schema.`;

    throw new Error(
      `MikroLens database schema is out of date. Table "${tableName}" is missing: ${missingColumns.join(", ")}. ${resetHint}`,
    );
  }
}
