import type { MagicLinkService } from "../../../application/services/MagicLinkService.ts";
import type { UserDTO } from "../../../domain/User.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface VerifyMagicLinkSignInFromInput {
  email?: string;
  token?: string;
}

/**
 * @description Verify a magic-link sign-in from a loose command payload while preserving HTTP-facing validation messages.
 */
export function verifyMagicLinkSignInFromInput(
  magicLinkService: Pick<MagicLinkService, "verify">,
  input: VerifyMagicLinkSignInFromInput,
): UserDTO {
  const email = input.email?.trim() ?? "";
  const token = input.token?.trim() ?? "";

  if (!token || !email) {
    throw new ValidationError("Both token and email are required.");
  }

  return magicLinkService.verify(token, email);
}
