import type { AccessPolicyCatalogRepository } from "../../../application/ports/MikroLensRepository.ts";
import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import { isAccessLevel } from "../../../domain/AccessPolicy.ts";

export function validateAccessPolicyInput(value: unknown, boardIds: Set<string>): string | null {
  if (value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    return "Permissions must be an object.";
  }

  const record = value as Record<string, unknown>;

  if (!record.boards || typeof record.boards !== "object") {
    return "Permissions must include a boards policy.";
  }

  const boards = record.boards as Record<string, unknown>;

  if (boards.scope === "all") {
    if (
      boards.level !== null &&
      (typeof boards.level !== "string" || !isAccessLevel(boards.level))
    ) {
      return "Boards access must use admin, editor, viewer, or null.";
    }
  } else if (boards.scope === "boards") {
    if (!Array.isArray(boards.grants)) {
      return "Board-scoped access must provide a grants list.";
    }

    const seenBoardIds = new Set<string>();

    for (const entry of boards.grants) {
      if (!entry || typeof entry !== "object") {
        return "Each board grant must be an object.";
      }

      const grant = entry as Record<string, unknown>;
      const boardId = typeof grant.boardId === "string" ? grant.boardId.trim() : "";
      const level = typeof grant.level === "string" ? grant.level : "";

      if (!boardId) {
        return "Each board grant must include a boardId.";
      }

      if (!boardIds.has(boardId)) {
        return `Unknown board ${boardId}.`;
      }

      if (!isAccessLevel(level)) {
        return "Each board grant must use admin, editor, or viewer.";
      }

      if (seenBoardIds.has(boardId)) {
        return `Board ${boardId} is listed more than once.`;
      }

      seenBoardIds.add(boardId);
    }
  } else {
    return "Boards access must use either all or boards scope.";
  }

  const signalsError = validateOptionalAccessLevel(record.signals, "Signals");

  if (signalsError) {
    return signalsError;
  }

  const documentsError = validateOptionalAccessLevel(record.documents, "Documents");

  if (documentsError) {
    return documentsError;
  }

  return null;
}

export function parseAccessPolicyInput(
  value: unknown,
  boardIds: Set<string>,
  fallback: AccessPolicy,
): AccessPolicy {
  if (value === undefined) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const boards = record.boards as Record<string, unknown>;

  if (boards.scope === "all") {
    return {
      boards: {
        level: parseOptionalAccessLevel(boards.level),
        scope: "all",
      },
      documents: parseOptionalAccessLevel(record.documents),
      signals: parseOptionalAccessLevel(record.signals),
    };
  }

  return {
    boards: {
      grants: Array.from(
        new Map(
          (boards.grants as Array<Record<string, unknown>>).map((grant) => [
            String(grant.boardId).trim(),
            {
              boardId: String(grant.boardId).trim(),
              level: grant.level,
            },
          ]),
        ).values(),
      )
        .filter((grant) => boardIds.has(grant.boardId))
        .sort((left, right) => left.boardId.localeCompare(right.boardId)) as Array<{
        boardId: string;
        level: "viewer" | "editor" | "admin";
      }>,
      scope: "boards",
    },
    documents: parseOptionalAccessLevel(record.documents),
    signals: parseOptionalAccessLevel(record.signals),
  };
}

export function buildBoardIds(repository: AccessPolicyCatalogRepository): Set<string> {
  return new Set(repository.listSpaces().map((space) => space.id));
}

function validateOptionalAccessLevel(value: unknown, label: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" && isAccessLevel(value)
    ? null
    : `${label} access must use admin, editor, viewer, or null.`;
}

function parseOptionalAccessLevel(value: unknown): AccessPolicy["documents"] {
  if (value === null || value === undefined) {
    return null;
  }

  return value as AccessPolicy["documents"];
}
