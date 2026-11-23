import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:8080"),
  SMTP_HOST: z.string().min(1).default("relay1.dataart.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(25),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: z.string().min(1).default("Ticket Tracker <no-reply@ticket-tracker.local>"),
});

const env = schema.parse(process.env);

export const config = {
  port: env.PORT,
  appBaseUrl: env.APP_BASE_URL.replace(/\/+$/, ""),
  /** Secure cookies only work over HTTPS; local http://localhost setups need them off. */
  cookieSecure: env.APP_BASE_URL.startsWith("https://"),
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  },
};
