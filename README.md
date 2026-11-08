# Jugendraum-Portal SV Heepen

Online-Buchung für den Jugendraum des SV Heepen: Mitglieder und Externe fragen den Raum an, das Orga-Team verwaltet alles im Admin-Bereich.

- **[KONZEPT.md](KONZEPT.md)**: Konzept, Regeln, Art Direction, Roadmap
- **[prototype/](prototype/index.html)**: der erste klickbare Entwurf (ohne Backend)
- **App** (dieses Repo): Next.js 15 + PostgreSQL, Mails über Resend

## Was die App kann

**Für Bucher** (Anfrage in vier Schritten: Anlass, Termin, Kontakt, Prüfen)
- Belegungskalender (anonym) mit Tagesansicht inkl. Pufferzeiten
- Formular in 4 Schritten mit Live-Prüfung: frei / Hinweis / belegt, inkl. Vorschlag für die nächste freie Zeit bzw. das nächste freie Party-Wochenende
- Pflicht-Haken „mit Michael Grieswelle oder Sigrid Brodig abgesprochen“ plus Auswahl der Person
- E-Mail-Bestätigung (Double-Opt-in). Unbestätigte Anfragen verfallen nach 24 h
- Ausstattung auswählen (Beamer, Musikanlage, …), Kosten und Kaution werden vorab angezeigt
- Persönliche Buchungsseite mit Statusverlauf, Kalenderdatei und Absage
- Rückmeldung nach dem Termin, inklusive Schadensmeldung (geht sofort ans Team)
- Mails: Bestätigungslink, Eingang, Bestätigung mit Kalenderdatei (.ics), Ablehnung mit Begründung, Erinnerung 3 Tage und 1 Tag vorher, Nachfrage danach

**Für das Orga-Team** (`/admin`, Login per Magic Link)
- Übersicht: offene Anfragen mit automatischer Konfliktprüfung, nächste Termine, Auslastung
- Bestätigen / Ablehnen (mit Begründung) / Stornieren, jeweils mit Mail an den Bucher
- Termine direkt eintragen, auch für andere und als Serie (wöchentlich, alle 2 Wochen, monatlich am n-ten Wochentag); Kollisionen werden übersprungen und aufgelistet
- Wählbar, welche Mails die Person bekommt: **keine** (Standard, auch keine Erinnerungen), nur Erinnerungen, oder Bestätigung und Erinnerungen. Pro Buchung oder Serie jederzeit umschaltbar
- Termine bearbeiten und verschieben, Bucher wird mit neuer Kalenderdatei informiert
- Regeln bei Bedarf bewusst übergehen (wird protokolliert), echte Überschneidungen bleiben gesperrt
- Übergabe- und Rückgabeprotokoll: Schlüssel, Stromzähler, Zustand, Mängel
- Nutzungsentgelt und Kaution mit Bezahlt/Abgerechnet/Einbehalten
- „Zu erledigen“: fällige Schlüsselübergaben, offene Rückgaben und Kautionen, Schadensmeldungen, Mailfehler
- Kalender mit Monats- und Wochenansicht (inkl. Pufferzeiten); an jedem Tag „Termin eintragen“ und „Tag sperren“, in der Wochenansicht „Woche sperren“
- **Sperrzeiten** mit Schnellauswahl (heute, dieses/nächstes Wochenende, diese/nächste Woche, Rest des Monats), ganztägig oder nur bestimmte Uhrzeiten, für alle Anfragen oder nur für Feiern. Bestehende Buchungen im Zeitraum werden angezeigt und bleiben gültig
- **Regelmäßige Sperren** nach Wochentagen, ganztägig oder stundenweise, optional befristet. Vorlagen: „Montags geschlossen“, „Werktags erst ab 17 Uhr“, „Sonntags keine Feiern“, „Nachts geschlossen“. Erscheinen auch öffentlich unter „Raum & Regeln“
- Buchungsliste mit Suche, Filtern und CSV-Export für Excel
- Statistik (Buchungen pro Monat, nach Art, Mitglieder/Externe, Mannschaften, Ablehnungsquote) und Rückmeldungen
- E-Mail-Texte, Ausstattung und Kosten in den Einstellungen änderbar
- Als App aufs Handy installierbar (PWA)
- Regeln einstellen: Puffer pro Kategorie, Freigabepflicht, „Party sperrt das ganze Wochenende“, Vorlauf, Kapazität
- Team & Rollen (Admin / Verwalter / Lesezugriff), Mail-Benachrichtigung pro Person
- Persönliches Kalender-Abo (iCal) für Handy oder Outlook
- Protokoll aller Änderungen und verschickten Mails
- Montags eine Wochenübersicht per Mail

**Regeln** (in `lib/rules.ts`, identisch im Browser und auf dem Server)
- Puffer vor/nach jedem Termin; zwischen zwei Terminen gilt der **größere** Puffer
- **Eine Party pro Wochenende** (Fr 12:00 bis Mo 06:00), zusätzlich in der Datenbank per Unique-Index abgesichert
- Keine überlappenden Termine, zusätzlich per Exclusion-Constraint in der Datenbank abgesichert
- Sperrzeiten, maximale Dauer, Buchungshorizont; Hinweise bei kurzem Vorlauf, zu vielen Gästen, spätem Party-Ende
- Besprechungen und Mannschaftssitzungen von Mitgliedern werden automatisch bestätigt (einstellbar)

## Lokal starten

Voraussetzungen: Node.js 20+, PostgreSQL 15+ (lokal oder Supabase).

```bash
npm install
cp .env.example .env.local        # Werte eintragen
npm run db:migrate                # Tabellen anlegen bzw. aktualisieren (mehrfach ausführbar)
npm run admin:add -- du@example.de "Dein Name" admin
npm run db:seed                   # optional: Beispielbuchungen für eine Test-Datenbank
npm run dev                       # http://localhost:3000
```

Ohne `RESEND_API_KEY` werden Mails nicht verschickt, sondern mit allen Links in der Konsole ausgegeben. Im Dev-Modus zeigt die Login-Seite den Login-Link dann auch direkt an.

Tests: `npm test` (Regel-Engine, Zeitzonen, Serien, iCal). Typprüfung: `npm run lint`.

## Live schalten (ca. 30 Minuten, 0 €)

1. **Datenbank:** Projekt bei [Supabase](https://supabase.com) anlegen, Region *Frankfurt (eu-central-1)*. Unter *Connect → Session pooler* die Verbindungs-URL kopieren. Lokal `DATABASE_URL=… npm run db:migrate` und `npm run admin:add` ausführen.
2. **Mails:** Konto bei [Resend](https://resend.com) (EU-Region), Domain `sv-heepen.de` verifizieren (DNS-Einträge SPF/DKIM beim Domain-Anbieter setzen), API-Key erzeugen.
3. **Hosting:** Repo bei [Vercel](https://vercel.com) importieren. Umgebungsvariablen aus `.env.example` setzen (`APP_URL` = endgültige Adresse, `SESSION_SECRET` und `CRON_SECRET` mit `openssl rand -hex 32` erzeugen). Die Region `fra1` und der tägliche Cron-Lauf (06:00 UTC) sind in `vercel.json` hinterlegt.
4. **Domain:** In Vercel `jugendraum.sv-heepen.de` hinzufügen und den CNAME beim Domain-Anbieter eintragen.
5. **Team einladen:** In der Verwaltung unter *Team* Michael Grieswelle, Sigrid Brodig und weitere Personen anlegen.

Datenschutz: Auftragsverarbeitungsverträge (AVV) mit Supabase, Vercel und Resend abschließen (bei allen im Dashboard verfügbar). Personenbezogene Daten werden 12 Monate nach dem Termin automatisch entfernt.

## Aufbau

```
app/
  page.tsx                  Buchungsseite (Kalender + Formular)
  api/belegung              anonyme Belegung für den Kalender
  api/buchungen             Anfrage anlegen (Prüfung, Sperre, Mail)
  bestaetigen/[token]       E-Mail-Bestätigung
  buchung/[token]           Buchung ansehen / stornieren
  raum                      Raum & Regeln, Hausordnung, Datenschutz
  buchung/[token]/feedback  Rückmeldung nach dem Termin
  admin/(app)/…             Übersicht, Kalender, Buchungen, Termin eintragen, Statistik,
                            Rückmeldungen, Sperrzeiten, Einstellungen, Team, Protokoll
  admin/anmelden            Magic-Link-Login
  api/ical/[token]          Kalender-Abo fürs Team
  api/cron/taeglich         Verfall, Erinnerungen, Nachfrage, Wochenübersicht, Löschung
components/BookingApp.tsx   Kalender, Tagesleiste, Formular, Ticket
lib/rules.ts                Buchungsregeln (+ rules.test.ts)
lib/series.ts               Serientermine (+ series.test.ts)
lib/time.ts                 Rechnen in Europe/Berlin
lib/data.ts                 Datenbankzugriffe
lib/mail.ts                 Mail-Vorlagen im Vereinsdesign
db/schema.sql               Tabellen, Constraints, Startwerte
```
