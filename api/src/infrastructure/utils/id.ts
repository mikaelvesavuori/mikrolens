import { MikroID } from "mikroid";

/**
 * MikroLens ID configuration.
 * Auto-generated IDs are 8 characters, URL-safe.
 */
const GENERATED_ID_LENGTH = 8;

/**
 * Generates a new MikroLens ID using the same MikroID profile as MolnOS Core.
 */
export function generateId(): string {
  return new MikroID().create(GENERATED_ID_LENGTH, "alphanumeric", false, true);
}
