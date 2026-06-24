import type { UserRole } from "./User.ts";

export type AccessLevel = "viewer" | "editor" | "admin";

/**
 * @description A single board-specific grant in a scoped board access policy.
 */
export interface BoardPermissionGrant {
  boardId: string;
  level: AccessLevel;
}

/**
 * @description Board access can apply to all boards at one level or a selected set of board grants.
 */
export type BoardAccess =
  | {
      scope: "all";
      level: AccessLevel | null;
    }
  | {
      scope: "boards";
      grants: BoardPermissionGrant[];
    };

/**
 * @description Shared access policy shape for human and non-human actors.
 */
export interface AccessPolicy {
  boards: BoardAccess;
  signals: AccessLevel | null;
  documents: AccessLevel | null;
}

export const accessLevels = ["viewer", "editor", "admin"] as const;

/**
 * @description Narrow a free-form string to a valid access level.
 */
export function isAccessLevel(value: string): value is AccessLevel {
  return accessLevels.includes(value as AccessLevel);
}

/**
 * @description Grant the same access level everywhere.
 */
export function createFullAccessPolicy(level: AccessLevel): AccessPolicy {
  return {
    boards: {
      level,
      scope: "all",
    },
    documents: level,
    signals: level,
  };
}

/**
 * @description Preserve broad defaults for invited users while allowing finer-grained overrides.
 */
export function createDefaultUserAccessPolicy(role: UserRole): AccessPolicy {
  return role === "Admin" ? createFullAccessPolicy("admin") : createFullAccessPolicy("editor");
}

/**
 * @description Start API identities with read-only access unless an admin scopes them further.
 */
export function createDefaultApiIdentityAccessPolicy(): AccessPolicy {
  return createFullAccessPolicy("viewer");
}

/**
 * @description Compare granted and required access levels.
 */
export function hasAccessLevel(
  grantedLevel: AccessLevel | null | undefined,
  requiredLevel: AccessLevel,
): boolean {
  if (!grantedLevel) {
    return false;
  }

  const accessLevelRanks: Record<AccessLevel, number> = {
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return accessLevelRanks[grantedLevel] >= accessLevelRanks[requiredLevel];
}

/**
 * @description Resolve the effective board access level for a specific board.
 */
export function resolveBoardAccessLevel(
  accessPolicy: AccessPolicy,
  boardId: string,
): AccessLevel | null | undefined {
  if (accessPolicy.boards.scope === "all") {
    return accessPolicy.boards.level;
  }

  return accessPolicy.boards.grants.find((grant) => grant.boardId === boardId)?.level;
}

/**
 * @description Return whether a policy can access a specific board at the requested level.
 */
export function canAccessBoard(
  accessPolicy: AccessPolicy,
  boardId: string,
  requiredLevel: AccessLevel,
): boolean {
  return hasAccessLevel(resolveBoardAccessLevel(accessPolicy, boardId), requiredLevel);
}

/**
 * @description Return whether a policy can access documents at the requested level.
 */
export function canAccessDocuments(
  accessPolicy: AccessPolicy,
  requiredLevel: AccessLevel,
): boolean {
  return hasAccessLevel(accessPolicy.documents, requiredLevel);
}

/**
 * @description Return whether a policy can access signals at the requested level.
 */
export function canAccessSignals(accessPolicy: AccessPolicy, requiredLevel: AccessLevel): boolean {
  return hasAccessLevel(accessPolicy.signals, requiredLevel);
}
