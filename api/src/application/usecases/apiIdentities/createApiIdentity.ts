import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import type {
  ApiIdentityProvisioningResult,
  ApiIdentityStatus,
} from "../../../domain/ApiIdentity.ts";
import { ApiIdentity } from "../../../domain/ApiIdentity.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import type { ApiIdentityCreationRepository } from "../../ports/MikroLensRepository.ts";
import { generateApiIdentityToken, hashApiIdentityToken } from "./apiIdentityTokens.ts";

export interface CreateApiIdentityInput {
  description?: string;
  name: string;
  permissions?: AccessPolicy;
  status?: ApiIdentityStatus;
}

/**
 * @description Create a new API identity for bots, services, or automation.
 */
export function createApiIdentity(
  repository: ApiIdentityCreationRepository,
  input: CreateApiIdentityInput,
): ApiIdentityProvisioningResult {
  const now = new Date().toISOString();
  const identity = ApiIdentity.provision({
    description: input.description,
    id: generateId(),
    name: input.name,
    now,
    permissions: input.permissions,
    status: input.status,
  }).toDTO();
  const token = generateApiIdentityToken();

  repository.saveApiIdentity(identity);
  repository.replaceApiIdentityToken(identity.id, hashApiIdentityToken(token), now);

  return {
    apiIdentity: identity,
    token,
  };
}
