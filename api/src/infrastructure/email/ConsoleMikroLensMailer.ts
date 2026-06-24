import type {
  MikroLensMailer,
  MikroLensMailerMessage,
} from "../../application/ports/MikroLensMailer.ts";

/**
 * @description Development mailer that logs the email payload instead of sending it.
 */
export class ConsoleMikroLensMailer implements MikroLensMailer {
  async send(message: MikroLensMailerMessage): Promise<void> {
    console.warn(
      [
        "MikroLens email delivery is not configured. Logging email instead.",
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        message.text,
      ].join("\n"),
    );
  }
}
