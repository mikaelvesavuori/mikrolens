import {
  type AccessLevel,
  type AccessPolicy,
  canAccessBoard,
  canAccessDocuments,
  canAccessSignals,
} from "../../domain/AccessPolicy.ts";
import type { ApiIdentityDTO } from "../../domain/ApiIdentity.ts";
import { hasUserPermission, MIKROLENS_PERMISSIONS } from "../../domain/Authorization.ts";
import type { UserDTO } from "../../domain/User.ts";
import { AuthenticationError, AuthorizationError } from "../../errors/MikroLensError.ts";
import type { UserRepository } from "../ports/MikroLensRepository.ts";

export type RecordActor =
  | {
      kind: "api-identity";
      identity: ApiIdentityDTO;
    }
  | {
      kind: "user";
      user: UserDTO;
    };

export function requireDocumentAccess(
  repository: Pick<UserRepository, "listUsers">,
  currentActor: RecordActor | null,
  requiredLevel: AccessLevel,
): void {
  const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);

  if (!canAccessDocuments(accessPolicy, requiredLevel)) {
    throw new AuthorizationError("Document access is required.");
  }
}

export function requireBoardAccess(
  repository: Pick<UserRepository, "listUsers">,
  currentActor: RecordActor | null,
  boardId: string,
  requiredLevel: AccessLevel,
): void {
  const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);

  if (!canAccessBoard(accessPolicy, boardId, requiredLevel)) {
    throw new AuthorizationError("Board access is required.");
  }
}

export function requireSignalAccess(
  repository: Pick<UserRepository, "listUsers">,
  currentActor: RecordActor | null,
  requiredLevel: AccessLevel,
): void {
  const accessPolicy = resolveRecordAccessPolicy(repository, currentActor);

  if (!canAccessSignals(accessPolicy, requiredLevel)) {
    throw new AuthorizationError("Signal access is required.");
  }
}

export function resolveRecordAccessPolicy(
  _repository: Pick<UserRepository, "listUsers">,
  currentActor: RecordActor | null,
): AccessPolicy {
  if (!currentActor) {
    throw new AuthenticationError("Sign in is required.");
  }

  if (
    currentActor.kind === "user" &&
    hasUserPermission(currentActor.user, MIKROLENS_PERMISSIONS.settings.manage)
  ) {
    return {
      boards: {
        level: "admin",
        scope: "all",
      },
      documents: "admin",
      signals: "admin",
    };
  }

  return currentActor.kind === "api-identity"
    ? currentActor.identity.permissions
    : currentActor.user.permissions;
}
