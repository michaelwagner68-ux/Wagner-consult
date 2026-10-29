import type { Config, Context } from "@netlify/functions";
import nodemailer from "nodemailer";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const field = (body: Record<string, unknown>, key: string, max = 200) =>
  String(body[key] ?? "").trim().slice(0, max);

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Honeypot: bots fill every field, humans never see this one.
  if (field(body, "website")) return json({ ok: true });

  const name = field(body, "name");
  const email = field(body, "email");
  const company = field(body, "company");
  const phone = field(body, "phone", 60);
  const topics = Array.isArray(body.topics) ? body.topics.map(String).slice(0, 10).join(", ") : "";
  const message = field(body, "message", 5000);

  if (!name || !message || !EMAIL_RE.test(email) || body.consent !== true) {
    return json({ ok: false, error: "invalid_input" }, 400);
  }

  const smtpHost = Netlify.env.get("SMTP_HOST");
  const smtpPort = Number(Netlify.env.get("SMTP_PORT") ?? "587");
  const smtpUser = Netlify.env.get("SMTP_USER");
  const smtpPass = Netlify.env.get("SMTP_PASS");
  const mailTo = Netlify.env.get("MAIL_TO") ?? "michael@wagner-consult.net";
  const mailFrom = Netlify.env.get("MAIL_FROM") ?? "no-reply@wagner-consult.net";

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error("Contact form submitted but SMTP is not configured");
    return json({ ok: false, error: "smtp_not_configured" }, 503);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const text =
    `Neue Kontaktanfrage über die Website\n` +
    `-------------------------------------\n\n` +
    `Name: ${name}\n` +
    `E-Mail: ${email}\n` +
    `Unternehmen: ${company || "-"}\n` +
    `Telefon: ${phone || "-"}\n` +
    `Themen: ${topics || "-"}\n\n` +
    `Nachricht:\n${message}\n`;

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: email,
      subject: `[Wagner Consult] Neue Kontaktanfrage von ${name}`,
      text,
    });
  } catch (err) {
    console.error("Failed to send contact email", err);
    return json({ ok: false, error: "send_failed" }, 500);
  }

  return json({ ok: true });
};

export const config: Config = {
  path: "/api/contact",
};
