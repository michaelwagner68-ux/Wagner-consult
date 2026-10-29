# Wagner Consult – Website

Statische Website (HTML/CSS/JS, kein Build-Schritt), gehostet auf Netlify.

- `index.html` – Startseite
- `impressum.html`, `datenschutz.html` – Rechtliches (gelb markierte Platzhalter ergänzen)
- `danke.html` – Bestätigungsseite nach Absenden des Kontaktformulars
- `netlify/functions/contact` – versendet Kontaktanfragen per SMTP (`/api/contact`)
- `netlify/functions/chat` – KI-Assistent über die Claude API (`/api/chat`); Widget erscheint nur, wenn `ANTHROPIC_API_KEY` gesetzt ist

Umgebungsvariablen siehe `.env.example` (im Netlify-Projekt setzen).
- `assets/` – CSS, JS, lokal gehostete Schriften (Fraunces, Inter), Favicon

Lokal mit Functions: `npm install` und `npx netlify-cli dev`.

Deploy: `npx netlify-cli deploy --prod` (Projekt ist nicht mit GitHub verbunden).

Portraitfoto: `assets/img/michael-wagner.jpg` (für schärfere Darstellung durch eine höher aufgelöste Version gleichen Namens ersetzen).
