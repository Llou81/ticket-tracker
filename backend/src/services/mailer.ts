import nodemailer from "nodemailer";
import { config } from "../config";

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password ?? "" } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Exposed as an object so tests can replace `send` with a spy.
export const mailer = {
  async send(message: MailMessage): Promise<void> {
    await transport.sendMail({ from: config.smtp.from, ...message });
  },
};
