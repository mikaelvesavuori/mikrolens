export interface MikroLensMailerMessage {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

/**
 * @description Minimal mailer contract used by MikroLens's invite and sign-in flows.
 */
export interface MikroLensMailer {
  send(message: MikroLensMailerMessage): Promise<void>;
}
