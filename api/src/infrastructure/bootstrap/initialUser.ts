import type { UserRepository } from "../../application/ports/MikroLensRepository.ts";
import type { MikroLensConfiguration } from "../../config/MikroLensConfiguration.ts";
import { User, type UserDTO } from "../../domain/User.ts";
import { generateId } from "../utils/id.ts";

export type InitialUserRepository = Pick<UserRepository, "listUsers" | "saveUser">;

/**
 * @description Create the configured first user exactly once for a fresh MikroLens database.
 */
export function seedInitialUserIfEmpty(
  repository: InitialUserRepository,
  initialUser: MikroLensConfiguration["auth"]["initialUser"],
): UserDTO | null {
  const email = initialUser.email.trim().toLowerCase();

  if (!email || repository.listUsers().length > 0) {
    return null;
  }

  const user = User.invite({
    email,
    id: generateId(),
    name: initialUser.name.trim() || email.split("@")[0],
    now: new Date().toISOString(),
    role: initialUser.role,
  }).toDTO();

  repository.saveUser(user);
  return user;
}
