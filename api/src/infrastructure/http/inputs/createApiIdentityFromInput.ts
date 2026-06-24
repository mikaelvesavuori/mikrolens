import type { ManagedApiIdentityCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createApiIdentity } from "../../../application/usecases/apiIdentities/createApiIdentity.ts";
import { createDefaultApiIdentityAccessPolicy } from "../../../domain/AccessPolicy.ts";
import type { ApiIdentityProvisioningResult } from "../../../domain/ApiIdentity.ts";
import { isApiIdentityStatus } from "../../../domain/ApiIdentity.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import {
  buildBoardIds,
  parseAccessPolicyInput,
  validateAccessPolicyInput,
} from "./accessPolicyInput.ts";

export interface CreateApiIdentityFromInput {
  description?: string;
  name?: string;
  permissions?: unknown;
  status?: string;
}

/**
 * @description Create an API identity from a loose command payload while resolving access policy defaults.
 */
export function createApiIdentityFromInput(
  repository: ManagedApiIdentityCreationRepository,
  input: CreateApiIdentityFromInput,
): ApiIdentityProvisioningResult {
  const name = input.name?.trim() ?? "";

  if (!name) {
    throw new ValidationError("Name is required.");
  }

  const boardIds = buildBoardIds(repository);
  const permissionsError = validateAccessPolicyInput(input.permissions, boardIds);

  if (permissionsError) {
    throw new ValidationError(permissionsError);
  }

  return createApiIdentity(repository, {
    description: input.description,
    name,
    permissions: parseAccessPolicyInput(
      input.permissions,
      boardIds,
      createDefaultApiIdentityAccessPolicy(),
    ),
    status: input.status && isApiIdentityStatus(input.status) ? input.status : undefined,
  });
}
