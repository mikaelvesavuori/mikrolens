import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import { User, type UserDTO, type UserRole } from "../../../domain/User.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { UserUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateUserInput {
  id: string;
  name?: string | null;
  permissions?: AccessPolicy;
  role?: UserRole;
}

/**
 * @description Update the profile and access policy for an existing user.
 */
export function updateUser(repository: UserUpdateRepository, input: UpdateUserInput): UserDTO {
  const existing = repository.getUser(input.id);

  if (!existing) {
    throw new NotFoundError("User not found.");
  }
  const updated = User.rehydrate(existing)
    .updateProfile({
      name: input.name,
      now: new Date().toISOString(),
      permissions: input.permissions,
      role: input.role,
    })
    .toDTO();

  repository.saveUser(updated);
  return updated;
}
