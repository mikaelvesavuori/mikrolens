import type { UserDTO } from "../../../domain/User.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { UserDeletionRepository } from "../../ports/MikroLensRepository.ts";

/**
 * @description Delete an existing user and any outstanding magic links.
 */
export function deleteUser(repository: UserDeletionRepository, userId: string): UserDTO {
  const user = repository.getUser(userId);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  repository.deleteUser(userId);
  return user;
}
