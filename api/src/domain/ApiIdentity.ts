import { ValidationError } from "../errors/MikroLensError.ts";
import type { AccessPolicy } from "./AccessPolicy.ts";
import { createDefaultApiIdentityAccessPolicy } from "./AccessPolicy.ts";

export type ApiIdentityStatus = "Active" | "Paused" | "Revoked";

/**
 * @description A non-human identity used by bots, services, and automation on the API.
 */
export interface ApiIdentityDTO {
  id: string;
  name: string;
  description: string;
  permissions: AccessPolicy;
  status: ApiIdentityStatus;
  lastUsedAt: string | null;
  tokenLastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const apiIdentityStatuses = ["Active", "Paused", "Revoked"] as const;

/**
 * @description A newly issued bearer token for an API identity. The token is only returned once.
 */
export interface ApiIdentityProvisioningResult {
  apiIdentity: ApiIdentityDTO;
  token: string;
}

export interface ProvisionApiIdentityInput {
  description?: string;
  id: string;
  name: string;
  now: string;
  permissions?: AccessPolicy;
  status?: ApiIdentityStatus;
}

export interface UpdateApiIdentityDetailsInput {
  description?: string;
  name?: string;
  now: string;
  permissions?: AccessPolicy;
  status?: ApiIdentityStatus;
}

export class ApiIdentity {
  private readonly dto: ApiIdentityDTO;

  private constructor(dto: ApiIdentityDTO) {
    this.dto = dto;
  }

  static provision(input: ProvisionApiIdentityInput): ApiIdentity {
    const now = requireText(input.now, "API identity timestamp is required.");
    const name = requireText(input.name, "Name is required.");

    return new ApiIdentity({
      createdAt: now,
      description: input.description?.trim() || `${name} automation identity.`,
      id: requireText(input.id, "API identity id is required."),
      lastUsedAt: null,
      name,
      permissions: input.permissions ?? createDefaultApiIdentityAccessPolicy(),
      status: input.status ?? "Active",
      tokenLastRotatedAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(dto: ApiIdentityDTO): ApiIdentity {
    return new ApiIdentity({ ...dto });
  }

  updateDetails(input: UpdateApiIdentityDetailsInput): ApiIdentity {
    return new ApiIdentity({
      ...this.dto,
      description: input.description?.trim() || this.dto.description,
      name: input.name?.trim() || this.dto.name,
      permissions: input.permissions ?? this.dto.permissions,
      status: input.status ?? this.dto.status,
      updatedAt: requireText(input.now, "API identity timestamp is required."),
    });
  }

  recordTokenRotation(now: string): ApiIdentity {
    const timestamp = requireText(now, "API identity timestamp is required.");

    return new ApiIdentity({
      ...this.dto,
      tokenLastRotatedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  recordUsage(now: string): ApiIdentity {
    const timestamp = requireText(now, "API identity timestamp is required.");

    return new ApiIdentity({
      ...this.dto,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  toDTO(): ApiIdentityDTO {
    return { ...this.dto };
  }
}

/**
 * @description Narrow a free-form string to a valid API identity status.
 */
export function isApiIdentityStatus(value: string): value is ApiIdentityStatus {
  return apiIdentityStatuses.includes(value as ApiIdentityStatus);
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}
