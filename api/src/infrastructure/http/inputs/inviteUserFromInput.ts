import type { ManagedUserInvitationRepository } from "../../../application/ports/MikroLensRepository.ts";
import type { MagicLinkService } from "../../../application/services/MagicLinkService.ts";
import { inviteUser } from "../../../application/usecases/users/inviteUser.ts";
import { createDefaultUserAccessPolicy } from "../../../domain/AccessPolicy.ts";
import type { UserDTO } from "../../../domain/User.ts";
import { isUserRole, isValidEmail } from "../../../domain/User.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import {
  buildBoardIds,
  parseAccessPolicyInput,
  validateAccessPolicyInput,
} from "./accessPolicyInput.ts";

export interface InviteUserFromInput {
  email?: string;
  name?: string;
  permissions?: unknown;
  role?: string;
}

/**
 * @description Invite a user from a loose command payload while resolving role and access policy defaults.
 */
export async function inviteUserFromInput(
  repository: ManagedUserInvitationRepository,
  magicLinkService: Pick<MagicLinkService, "sendInvite">,
  baseUrl: string,
  input: InviteUserFromInput,
): Promise<UserDTO> {
  const email = input.email?.trim() ?? "";

  if (!email) {
    throw new ValidationError("Email is required.");
  }

  if (!isValidEmail(email)) {
    throw new ValidationError("Email must be valid.");
  }

  if (input.role && !isUserRole(input.role)) {
    throw new ValidationError("Role must be either User or Admin.");
  }

  const role = input.role && isUserRole(input.role) ? input.role : "User";
  const boardIds = buildBoardIds(repository);
  const permissionsError = validateAccessPolicyInput(input.permissions, boardIds);

  if (permissionsError) {
    throw new ValidationError(permissionsError);
  }

  return inviteUser(repository, magicLinkService, baseUrl, {
    email,
    name: input.name,
    permissions: parseAccessPolicyInput(
      input.permissions,
      boardIds,
      createDefaultUserAccessPolicy(role),
    ),
    role,
  });
}
