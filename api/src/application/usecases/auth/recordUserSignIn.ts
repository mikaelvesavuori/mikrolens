import { User, type UserDTO } from "../../../domain/User.ts";
import type { UserRepository } from "../../ports/MikroLensRepository.ts";

export function recordUserSignIn(
  repository: Pick<UserRepository, "saveUser">,
  user: UserDTO,
  timestamp = new Date().toISOString(),
): UserDTO {
  const updatedUser = User.rehydrate(user).recordSignIn(timestamp).toDTO();

  repository.saveUser(updatedUser);

  return updatedUser;
}
