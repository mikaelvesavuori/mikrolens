import type { StorageProvider } from "mikroauth";
import type { MikroLensDatabase } from "../database/MikroLensDatabase.ts";

/**
 * @description MikroAuth storage backed by the same SQLite database as MikroLens.
 */
export class SqliteMikroAuthStorageProvider implements StorageProvider {
  constructor(private readonly database: MikroLensDatabase) {}

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    this.deleteExpiredRows();
    this.database.run(
      `
        INSERT INTO auth_storage (storage_key, value, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(storage_key) DO UPDATE SET
          value = excluded.value,
          expires_at = excluded.expires_at
      `,
      key,
      value,
      toExpiryTimestamp(expirySeconds),
    );
  }

  async get(key: string): Promise<string | null> {
    this.deleteExpiredRows();
    const row = this.database.get<{ value: string }>(
      "SELECT value FROM auth_storage WHERE storage_key = ?",
      key,
    );

    return row?.value ?? null;
  }

  async delete(key: string): Promise<void> {
    this.database.run("DELETE FROM auth_storage WHERE storage_key = ?", key);
    this.database.run("DELETE FROM auth_storage_collections WHERE collection_key = ?", key);
  }

  async addToCollection(
    collectionKey: string,
    item: string,
    expirySeconds?: number,
  ): Promise<void> {
    this.deleteExpiredRows();
    this.database.run(
      `
        INSERT INTO auth_storage_collections (collection_key, item, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(collection_key, item) DO UPDATE SET
          expires_at = excluded.expires_at
      `,
      collectionKey,
      item,
      toExpiryTimestamp(expirySeconds),
      Date.now(),
    );
  }

  async removeFromCollection(collectionKey: string, item: string): Promise<void> {
    this.database.run(
      "DELETE FROM auth_storage_collections WHERE collection_key = ? AND item = ?",
      collectionKey,
      item,
    );
  }

  async getCollection(collectionKey: string): Promise<string[]> {
    this.deleteExpiredRows();
    return this.database
      .all<{ item: string }>(
        `
          SELECT item
          FROM auth_storage_collections
          WHERE collection_key = ?
          ORDER BY created_at ASC
        `,
        collectionKey,
      )
      .map((row) => row.item);
  }

  async getCollectionSize(collectionKey: string): Promise<number> {
    this.deleteExpiredRows();
    const row = this.database.get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM auth_storage_collections
        WHERE collection_key = ?
      `,
      collectionKey,
    );

    return row?.count ?? 0;
  }

  async removeOldestFromCollection(collectionKey: string): Promise<string | null> {
    this.deleteExpiredRows();
    const row = this.database.get<{ item: string }>(
      `
        SELECT item
        FROM auth_storage_collections
        WHERE collection_key = ?
        ORDER BY created_at ASC
        LIMIT 1
      `,
      collectionKey,
    );

    if (!row) {
      return null;
    }

    await this.removeFromCollection(collectionKey, row.item);
    return row.item;
  }

  async findKeys(pattern: string): Promise<string[]> {
    this.deleteExpiredRows();
    const matcher = patternToRegExp(pattern);
    const keys = this.database
      .all<{ key: string }>(
        `
          SELECT storage_key AS key FROM auth_storage
          UNION
          SELECT collection_key AS key FROM auth_storage_collections
        `,
      )
      .map((row) => row.key)
      .filter((key) => matcher.test(key));

    return [...new Set(keys)];
  }

  private deleteExpiredRows(): void {
    const now = Date.now();
    this.database.run(
      "DELETE FROM auth_storage WHERE expires_at IS NOT NULL AND expires_at <= ?",
      now,
    );
    this.database.run(
      "DELETE FROM auth_storage_collections WHERE expires_at IS NOT NULL AND expires_at <= ?",
      now,
    );
  }
}

function toExpiryTimestamp(expirySeconds?: number): number | null {
  return expirySeconds && expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : null;
}

function patternToRegExp(pattern: string): RegExp {
  const regex = [...pattern]
    .map((char) => {
      if (char === "*") {
        return ".*";
      }

      if (char === "?") {
        return ".";
      }

      return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("");

  return new RegExp(`^${regex}$`);
}
