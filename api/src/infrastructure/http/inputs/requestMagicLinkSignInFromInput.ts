import type { MagicLinkService } from "../../../application/services/MagicLinkService.ts";
import { isValidEmail } from "../../../domain/User.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface RequestMagicLinkSignInFromInput {
  email?: string;
}

/**
 * @description Request a magic-link sign-in from a loose command payload while preserving HTTP-facing validation messages.
 */
export async function requestMagicLinkSignInFromInput(
  magicLinkService: Pick<MagicLinkService, "sendSignInLink">,
  baseUrl: string,
  input: RequestMagicLinkSignInFromInput,
): Promise<{ message: string }> {
  const email = input.email?.trim() ?? "";

  if (!email) {
    throw new ValidationError("Email is required.");
  }

  if (!isValidEmail(email)) {
    throw new ValidationError("Email must be valid.");
  }

  return magicLinkService.sendSignInLink(email, baseUrl);
}
