import type { UserDTO } from "../../../domain/User.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { OAuthUserSignInRepository } from "../../ports/MikroLensRepository.ts";
import { recordUserSignIn } from "./recordUserSignIn.ts";

/**
 * @description Activate and sign in an already-invited user after a trusted OAuth callback.
 */
export function signInUserFromOAuth(repository: OAuthUserSignInRepository, email: string): UserDTO {
  const normalizedEmail = email.trim().toLowerCase();
  const user = repository.getUserByEmail(normalizedEmail);

  if (!user) {
    throw new NotFoundError("User not found. You must be invited before signing in with SSO.");
  }

  return recordUserSignIn(repository, user);
}
