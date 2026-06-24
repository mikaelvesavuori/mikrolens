export type MagicLinkPurpose = "invite" | "signin";

/**
 * @description A single-use email link used for invitations and sign-in.
 */
export interface MagicLink {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  purpose: MagicLinkPurpose;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}
