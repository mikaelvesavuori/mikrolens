import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import type { UserDTO, UserRole } from "../../../domain/User.ts";
import type { UserInvitationRepository } from "../../ports/MikroLensRepository.ts";
import type { MagicLinkService } from "../../services/MagicLinkService.ts";
import { createUser } from "./createUser.ts";

export interface InviteUserInput {
  email: string;
  name?: string;
  permissions?: AccessPolicy;
  role?: UserRole;
}

/**
 * @description Invite a user and roll back the record if the invite cannot be delivered.
 */
export async function inviteUser(
  repository: UserInvitationRepository,
  magicLinkService: Pick<MagicLinkService, "sendInvite">,
  baseUrl: string,
  input: InviteUserInput,
): Promise<UserDTO> {
  const created = createUser(repository, input);

  try {
    await magicLinkService.sendInvite(created, baseUrl);
  } catch (error) {
    repository.deleteUser(created.id);
    throw error;
  }

  return created;
}
