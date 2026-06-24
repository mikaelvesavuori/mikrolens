import type { UserDTO, UserRole } from "./User.ts";

export const MIKROLENS_PERMISSIONS = Object.freeze({
  apiIdentities: Object.freeze({
    manage: "settings.api-identities.manage",
    read: "settings.api-identities.read",
  }),
  documents: Object.freeze({
    read: "documents.read",
    write: "documents.write",
  }),
  horizons: Object.freeze({
    manage: "settings.horizons.manage",
    read: "settings.horizons.read",
  }),
  intake: Object.freeze({
    read: "intake.read",
    write: "intake.write",
  }),
  plan: Object.freeze({
    read: "plan.read",
    write: "plan.write",
  }),
  settings: Object.freeze({
    manage: "settings.manage",
    read: "settings.read",
  }),
  spaces: Object.freeze({
    manage: "settings.spaces.manage",
    read: "settings.spaces.read",
  }),
  understand: Object.freeze({
    read: "understand.read",
  }),
  users: Object.freeze({
    manage: "settings.users.manage",
    read: "settings.users.read",
  }),
  webhooks: Object.freeze({
    manage: "settings.webhooks.manage",
    read: "settings.webhooks.read",
  }),
  work: Object.freeze({
    read: "work.read",
    write: "work.write",
  }),
});

const USER_PERMISSIONS = Object.freeze([
  MIKROLENS_PERMISSIONS.understand.read,
  MIKROLENS_PERMISSIONS.plan.read,
  MIKROLENS_PERMISSIONS.plan.write,
  MIKROLENS_PERMISSIONS.work.read,
  MIKROLENS_PERMISSIONS.work.write,
  MIKROLENS_PERMISSIONS.intake.read,
  MIKROLENS_PERMISSIONS.intake.write,
  MIKROLENS_PERMISSIONS.documents.read,
  MIKROLENS_PERMISSIONS.documents.write,
]);

const ADMIN_PERMISSIONS = Object.freeze([
  ...new Set([
    ...USER_PERMISSIONS,
    MIKROLENS_PERMISSIONS.settings.read,
    MIKROLENS_PERMISSIONS.settings.manage,
    MIKROLENS_PERMISSIONS.spaces.read,
    MIKROLENS_PERMISSIONS.spaces.manage,
    MIKROLENS_PERMISSIONS.horizons.read,
    MIKROLENS_PERMISSIONS.horizons.manage,
    MIKROLENS_PERMISSIONS.users.read,
    MIKROLENS_PERMISSIONS.users.manage,
    MIKROLENS_PERMISSIONS.apiIdentities.read,
    MIKROLENS_PERMISSIONS.apiIdentities.manage,
    MIKROLENS_PERMISSIONS.webhooks.read,
    MIKROLENS_PERMISSIONS.webhooks.manage,
  ]),
]);

const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly string[]>> = Object.freeze({
  Admin: ADMIN_PERMISSIONS,
  User: USER_PERMISSIONS,
});

export type MikroLensPermission = string;

export function permissionsForRole(role: UserRole): readonly string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function publicUserPermissions(user: Pick<UserDTO, "role"> | null | undefined): string[] {
  return user ? [...permissionsForRole(user.role)] : [];
}

export function hasUserPermission(
  user: Pick<UserDTO, "role"> | null | undefined,
  permission: string,
): boolean {
  return publicUserPermissions(user).includes(permission);
}
