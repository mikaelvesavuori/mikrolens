import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import { User, type UserDTO, type UserRole } from "../../../domain/User.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import type { UserCreationRepository } from "../../ports/MikroLensRepository.ts";

export interface CreateUserInput {
  email: string;
  name?: string;
  permissions?: AccessPolicy;
  role?: UserRole;
}

/**
 * @description Create a new user record that can later activate via email link.
 */
export function createUser(repository: UserCreationRepository, input: CreateUserInput): UserDTO {
  const email = input.email.trim().toLowerCase();

  if (repository.getUserByEmail(email)) {
    throw new ValidationError("A user with that email already exists.");
  }

  const user = User.invite({
    email,
    id: generateId(),
    name: input.name,
    now: new Date().toISOString(),
    permissions: input.permissions,
    role: input.role,
  }).toDTO();

  repository.saveUser(user);
  return user;
}
