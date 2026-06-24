import { createHash, randomBytes } from "node:crypto";

export function generateApiIdentityToken(): string {
  return `ast_api_${randomBytes(24).toString("base64url")}`;
}

export function hashApiIdentityToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
