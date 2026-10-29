import type { Config, Context } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_TURNS = 20;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT =
  "Du bist der KI-Assistent von Wagner Consult, der Unternehmensberatung von Michael Wagner " +
  "(michael@wagner-consult.net, +49 170 5599111, 45127 Essen, deutschlandweit im Einsatz). " +
  "Wagner Consult begleitet Mittelstand und Konzernbereiche von der KI-Strategie bis zur skalierbaren Umsetzung. " +
  "Leistungsfelder: 1) KI & Digitale Transformation: KI-Strategie & Readiness, KI-Assistenten & Agenten, " +
  "Prozessautomatisierung, Governance & Compliance (EU AI Act, DSGVO). " +
  "2) Strategie, Prozesse & Steuerung: Unternehmensberatung, Prozessoptimierung, Performance & Reporting, Change & Adoption. " +
  "3) IT-Strategie & Sourcing: IT-Strategie & Cloud, Outsourcing & Managed Services, Software- & Anbieterauswahl, " +
  "IT-Betrieb & Service-Management. " +
  "KI-Programme werden entlang der Dimensionen Menschen, Organisation und Technologie gedacht. " +
  "Vorgehen in 4 Phasen: Analyse & Discovery, Strategie & Konzept, Umsetzung & Pilot, Skalierung & Betrieb. " +
  "Einstiegsformate: kostenfreier KI-Readiness-Check, Use-Case-Workshop, Strategie-Sprint. " +
  "Michael Wagner hat über 25 Jahre Erfahrung in Beratung, IT-Strategie und Digitalisierung; Kunden arbeiten direkt mit ihm. " +
  "Nenne keine weiteren Kennzahlen, Referenzkunden oder Preise, die hier nicht stehen. " +
  "Antworte freundlich, kompetent und prägnant auf Deutsch (oder in der Sprache des Besuchers). " +
  "Dein Ziel ist es, Anfragen zu qualifizieren: erfrage höflich Name, Unternehmen, E-Mail-Adresse und das Anliegen, " +
  "falls noch nicht bekannt, damit Michael Wagner sich persönlich melden kann. " +
  "Mache keine Preis- oder Vertragszusagen, sondern verweise auf ein kostenloses Erstgespräch. " +
  "WICHTIG: Antworte ausschließlich in reinem Fließtext ohne Markdown-Formatierung — " +
  "keine Tabellen, keine Überschriften, keine Sternchen, keine Aufzählungszeichen. " +
  "Halte Antworten kurz (maximal 3-4 Sätze) und stelle höchstens eine Frage pro Antwort.";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function extractLeadEmail(history: ChatMessage[]): string | null {
  for (const turn of history) {
    if (turn.role !== "user") continue;
    const match = turn.content.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (match) return match[0];
  }
  return null;
}

export default async (req: Request, _context: Context) => {
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");

  // The widget asks first whether the assistant is configured and stays hidden otherwise.
  if (req.method === "GET") return json({ enabled: Boolean(apiKey) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!apiKey) return json({ error: "not_configured" }, 503);

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!history.length || history[0].role !== "user") return json({ error: "empty_history" }, 400);

  let reply: string;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: Netlify.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: history,
    });
    reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  } catch (err) {
    console.error("Anthropic API call failed", err);
    return json({ error: "ai_error" }, 500);
  }

  // Forward the conversation to Michael Wagner once the visitor has left an email address.
  const leadEmail = extractLeadEmail(history);
  const smtpHost = Netlify.env.get("SMTP_HOST");
  const smtpPort = Number(Netlify.env.get("SMTP_PORT") ?? "587");
  const smtpUser = Netlify.env.get("SMTP_USER");
  const smtpPass = Netlify.env.get("SMTP_PASS");
  const mailTo = Netlify.env.get("MAIL_TO") ?? "michael@wagner-consult.net";
  const mailFrom = Netlify.env.get("MAIL_FROM") ?? "no-reply@wagner-consult.net";

  if (leadEmail && smtpHost && smtpUser && smtpPass) {
    const transcript =
      history.map((m) => `${m.role === "user" ? "Besucher" : "Assistent"}: ${m.content}`).join("\n\n") +
      `\n\nAssistent: ${reply}`;

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: mailFrom,
        to: mailTo,
        replyTo: leadEmail,
        subject: "[Wagner Consult] Neue Anfrage über den KI-Chat",
        text:
          `Neue Anfrage über den KI-Chat auf der Website\n` +
          `-----------------------------------------------\n\n` +
          `E-Mail des Interessenten: ${leadEmail}\n\n` +
          `Transkript:\n${transcript}\n`,
      });
    } catch (err) {
      console.error("Failed to forward chat transcript by email", err);
    }
  }

  return json({ reply });
};

export const config: Config = {
  path: "/api/chat",
};
