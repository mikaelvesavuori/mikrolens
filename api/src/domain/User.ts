import { ValidationError } from "../errors/MikroLensError.ts";
import type { AccessPolicy } from "./AccessPolicy.ts";
import { createDefaultUserAccessPolicy } from "./AccessPolicy.ts";

export type UserRole = "User" | "Admin";
export type UserStatus = "Invited" | "Active";

/**
 * @description A human user who can receive passwordless sign-in links.
 */
export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions: AccessPolicy;
  status: UserStatus;
  invitedAt: string;
  activatedAt: string | null;
  lastSignedInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const userRoles = ["User", "Admin"] as const;
export const userStatuses = ["Invited", "Active"] as const;

export interface InviteUserInput {
  email: string;
  id: string;
  name?: string | null;
  now: string;
  permissions?: AccessPolicy;
  role?: UserRole;
}

export interface UpdateUserProfileInput {
  name?: string | null;
  now: string;
  permissions?: AccessPolicy;
  role?: UserRole;
}

export class User {
  private readonly dto: UserDTO;

  private constructor(dto: UserDTO) {
    this.dto = dto;
  }

  static invite(input: InviteUserInput): User {
    const now = requireText(input.now, "User timestamp is required.");
    const email = normalizeEmail(input.email);
    const role = input.role ?? "User";

    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError("Email must be valid.");
    }

    return new User({
      activatedAt: null,
      createdAt: now,
      email,
      id: requireText(input.id, "User id is required."),
      invitedAt: now,
      lastSignedInAt: null,
      name: normalizeNullableText(input.name),
      permissions: input.permissions ?? createDefaultUserAccessPolicy(role),
      role,
      status: "Invited",
      updatedAt: now,
    });
  }

  static rehydrate(dto: UserDTO): User {
    return new User({ ...dto });
  }

  updateProfile(input: UpdateUserProfileInput): User {
    return new User({
      ...this.dto,
      name: input.name === undefined ? this.dto.name : normalizeNullableText(input.name),
      permissions: input.permissions ?? this.dto.permissions,
      role: input.role ?? this.dto.role,
      updatedAt: requireText(input.now, "User timestamp is required."),
    });
  }

  recordSignIn(now: string): User {
    const timestamp = requireText(now, "User timestamp is required.");

    return new User({
      ...this.dto,
      activatedAt: this.dto.activatedAt ?? timestamp,
      lastSignedInAt: timestamp,
      status: "Active",
      updatedAt: timestamp,
    });
  }

  toDTO(): UserDTO {
    return { ...this.dto };
  }
}

/**
 * @description Narrow a free-form string to a valid user role.
 */
export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}

/**
 * @description Validate that a user email is syntactically well formed.
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim().toLowerCase());
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new ValidationError("Email is required.");
  }

  return normalized;
}

function normalizeNullableText(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}
