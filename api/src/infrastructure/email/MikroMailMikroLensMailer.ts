import { MikroMail } from "mikromail";

import type {
  MikroLensMailer,
  MikroLensMailerMessage,
} from "../../application/ports/MikroLensMailer.ts";

export interface MikroMailMikroLensMailerConfig {
  debug?: boolean;
  host: string;
  maxRetries?: number;
  password: string;
  port?: number;
  secure?: boolean;
  user: string;
}

/**
 * @description SMTP-backed mailer using MikroMail.
 */
export class MikroMailMikroLensMailer implements MikroLensMailer {
  private readonly client: MikroMail;
  private readonly sender: string;

  constructor(config: MikroMailMikroLensMailerConfig) {
    this.client = new MikroMail({
      config: {
        debug: config.debug,
        host: config.host,
        maxRetries: config.maxRetries,
        password: config.password,
        port: config.port,
        secure: config.secure,
        user: config.user,
      },
    });
    this.sender = config.user;
  }

  async send(message: MikroLensMailerMessage): Promise<void> {
    await this.client.send({
      from: this.sender,
      html: message.html,
      subject: message.subject,
      text: message.text,
      to: message.to,
    });
  }
}
