import type { ManagedUserUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateUser } from "../../../application/usecases/users/updateUser.ts";
import type { UserDTO } from "../../../domain/User.ts";
import { isUserRole } from "../../../domain/User.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  buildBoardIds,
  parseAccessPolicyInput,
  validateAccessPolicyInput,
} from "./accessPolicyInput.ts";

export interface UpdateUserFromInput {
  id: string;
  name?: string | null;
  permissions?: unknown;
  role?: string;
}

/**
 * @description Update a user from a loose command payload while preserving existing access defaults.
 */
export function updateUserFromInput(
  repository: ManagedUserUpdateRepository,
  input: UpdateUserFromInput,
): UserDTO {
  const existing = repository.getUser(input.id);

  if (!existing) {
    throw new NotFoundError("User not found.");
  }

  if (input.role && !isUserRole(input.role)) {
    throw new ValidationError("Role must be either User or Admin.");
  }

  const boardIds = buildBoardIds(repository);
  const permissionsError = validateAccessPolicyInput(input.permissions, boardIds);

  if (permissionsError) {
    throw new ValidationError(permissionsError);
  }

  return updateUser(repository, {
    id: input.id,
    name: Object.hasOwn(input, "name") ? (input.name ?? null) : undefined,
    permissions: parseAccessPolicyInput(input.permissions, boardIds, existing.permissions),
    role: input.role && isUserRole(input.role) ? input.role : undefined,
  });
}
