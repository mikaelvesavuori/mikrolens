import { createHash, randomBytes } from "node:crypto";

import type { MagicLink, MagicLinkPurpose } from "../../domain/MagicLink.ts";
import type { UserDTO } from "../../domain/User.ts";
import { isValidEmail } from "../../domain/User.ts";
import { ValidationError } from "../../errors/MikroLensError.ts";
import { generateId } from "../../infrastructure/utils/id.ts";
import type { MikroLensMailer } from "../ports/MikroLensMailer.ts";
import type { MagicLinkAuthRepository } from "../ports/MikroLensRepository.ts";
import { recordUserSignIn } from "../usecases/auth/recordUserSignIn.ts";

const defaultExpiryMinutes = Number(process.env.MIKROLENS_MAGIC_LINK_EXPIRY_MINUTES ?? "30");
const defaultEmailSubject = process.env.MIKROLENS_EMAIL_SUBJECT?.trim() || "Sign in to MikroLens";

/**
 * @description Create, verify, and email single-use magic links for users.
 */
export class MagicLinkService {
  private readonly repository: MagicLinkAuthRepository;
  private readonly mailer: MikroLensMailer;
  private readonly expiryMinutes: number;
  private readonly emailSubject: string;

  constructor(
    repository: MagicLinkAuthRepository,
    mailer: MikroLensMailer,
    expiryMinutes = defaultExpiryMinutes,
    emailSubject = defaultEmailSubject,
  ) {
    this.repository = repository;
    this.mailer = mailer;
    this.expiryMinutes = expiryMinutes;
    this.emailSubject = emailSubject;
  }

  async sendInvite(user: UserDTO, baseUrl: string): Promise<void> {
    await this.createAndSendMagicLink(user, "invite", baseUrl);
  }

  async sendSignInLink(email: string, baseUrl: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const message = "If this email can sign in, you will receive a sign-in link shortly.";

    if (!isValidEmail(normalizedEmail)) {
      throw new ValidationError("Email must be valid.");
    }

    const user = this.repository.getUserByEmail(normalizedEmail);

    if (!user) {
      return { message };
    }

    await this.createAndSendMagicLink(user, "signin", baseUrl);
    return { message };
  }

  verify(token: string, email: string): UserDTO {
    const normalizedEmail = email.trim().toLowerCase();

    if (!token.trim() || !isValidEmail(normalizedEmail)) {
      throw new ValidationError("This sign-in link is invalid.");
    }

    const link = this.repository.getMagicLinkByTokenHash(hashMagicLinkToken(token));

    if (!link || link.email !== normalizedEmail) {
      throw new ValidationError("This sign-in link is invalid.");
    }

    if (link.usedAt) {
      throw new ValidationError("This sign-in link has already been used.");
    }

    const now = new Date();

    if (new Date(link.expiresAt).getTime() < now.getTime()) {
      throw new ValidationError("This sign-in link has expired.");
    }

    const user = this.repository.getUser(link.userId);

    if (!user || user.email !== normalizedEmail) {
      throw new ValidationError("This sign-in link is invalid.");
    }

    const timestamp = now.toISOString();
    this.repository.markMagicLinkUsed(link.id, timestamp);

    return recordUserSignIn(this.repository, user, timestamp);
  }

  private async createAndSendMagicLink(
    user: UserDTO,
    purpose: MagicLinkPurpose,
    baseUrl: string,
  ): Promise<void> {
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const expiresAt = new Date(createdAt.getTime() + this.expiryMinutes * 60_000).toISOString();
    const token = generateMagicLinkToken();

    this.repository.revokeActiveMagicLinksForUser(user.id, createdAtIso);

    const link: MagicLink = {
      createdAt: createdAtIso,
      email: user.email,
      expiresAt,
      id: generateId(),
      purpose,
      tokenHash: hashMagicLinkToken(token),
      usedAt: null,
      userId: user.id,
    };

    this.repository.saveMagicLink(link);

    try {
      const magicLink = buildMagicLink(baseUrl, token, user.email);
      const copy = renderEmailCopy(user, purpose, magicLink, this.expiryMinutes, this.emailSubject);

      await this.mailer.send({
        html: copy.html,
        subject: copy.subject,
        text: copy.text,
        to: user.email,
      });
    } catch (error) {
      this.repository.deleteMagicLink(link.id);
      throw error;
    }
  }
}

export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

function buildMagicLink(baseUrl: string, token: string, email: string): string {
  const url = new URL("/auth/verify", baseUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

function renderEmailCopy(
  user: UserDTO,
  purpose: MagicLinkPurpose,
  magicLink: string,
  expiryMinutes: number,
  emailSubject: string,
) {
  const label = purpose === "invite" ? "Join MikroLens" : "Sign in to MikroLens";
  const subject = purpose === "invite" ? "You're invited to MikroLens" : emailSubject;
  const greetingName = user.name?.trim() || user.email;
  const intro =
    purpose === "invite"
      ? `You've been invited to MikroLens as ${user.role}.`
      : "Use the secure link below to sign in to MikroLens.";

  return {
    html: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;color:#16202f;font-family:Inter,system-ui,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid rgba(22,32,47,0.08);border-radius:18px;padding:32px;box-shadow:0 20px 40px rgba(22,32,47,0.08);">
        <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4666c8;">MikroLens</p>
        <h1 style="margin:0 0 12px 0;font-size:28px;line-height:1.15;">${label}</h1>
        <p style="margin:0 0 10px 0;font-size:16px;line-height:1.6;">Hi ${escapeHtml(greetingName)},</p>
        <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
        <a href="${magicLink}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#1665d8;color:#ffffff;text-decoration:none;font-weight:700;">${label}</a>
        <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#5f6b7a;">This link expires in ${expiryMinutes} minutes and can only be used once.</p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#7b8796;">If the button does not work, copy and paste this URL into your browser:</p>
        <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;word-break:break-all;color:#1665d8;">${magicLink}</p>
      </div>
    </div>
  </body>
</html>`,
    subject,
    text: [
      `Hi ${greetingName},`,
      "",
      intro,
      "",
      `${label}: ${magicLink}`,
      "",
      `This link expires in ${expiryMinutes} minutes and can only be used once.`,
    ].join("\n"),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
