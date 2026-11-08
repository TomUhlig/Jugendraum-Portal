# Jugendraum-Portal SV Heepen – Konzept

> Buchungsportal für den Jugendraum des SV Heepen. Mitglieder und Externe können den Raum online anfragen, das Orga-Team verwaltet alles über einen Admin-Bereich.
>
> Stand: November 2026 · Klickbarer Prototyp: [`prototype/index.html`](prototype/index.html)

---

## 1. Ziel in einem Satz

**Den Jugendraum in unter 2 Minuten anfragen und ohne Doppelbuchungen, Party-Chaos am Wochenende oder WhatsApp-Pingpong verwalten.**

### Zielgruppen

| Gruppe | Was sie brauchen | Typische Anlässe |
|---|---|---|
| **Trainer & Betreuer** | schnell, mobil, ohne Login | Trainerbesprechung, Mannschaftssitzung, Elternabend |
| **Vorstand & Abteilungen** | Überblick, Serientermine | Vorstandssitzung, JHV-Vorbereitung, Workshops |
| **Mitglieder privat** | klarer Ablauf, Bestätigung | Geburtstag, Abschlussfeier |
| **Externe** | Vertrauen, klare Regeln und Kosten | 40. Geburtstag, Kursangebote |
| **Orga-Team (Admins)** | Kalender, Freigabe, Erinnerungen | Michael Grieswelle, Sigrid Brodig, Tom + weitere |

---

## 2. Recherche: Was gute Buchungssysteme können

Kurzer Blick auf Raum- und Terminbuchungstools (u. a. Calendly, SuperSaaS, GoBright, Jotform, Koalendar sowie Vereinskalender wie kalender.digital und Webling). Daraus übernommen:

| Standard-Feature | Übernehmen? | Umsetzung bei uns |
|---|---|---|
| Self-Service-Buchungsseite mit Verfügbarkeitsanzeige | ✅ MVP | Wochen-/Monatskalender, belegte Zeiten sind sichtbar, aber anonym |
| Pufferzeiten vor/nach Buchungen (Auf-/Abbau, Reinigung) | ✅ MVP | pro Kategorie einstellbar |
| Freigabe-Workflow (Anfrage → bestätigt) | ✅ MVP | Status *Angefragt / Bestätigt / Abgelehnt / Storniert* |
| Buchungslimits / Regeln | ✅ MVP | **max. 1 Party pro Wochenende**, Vorlaufzeit, Max-Dauer |
| Bestätigungs- & Erinnerungsmails mit Kalendereintrag (.ics) | ✅ MVP | automatisch, Vorlagen im Admin editierbar |
| Kalender-Sync (Google/Outlook/Apple) | ✅ Phase 2 | iCal-Abo-Link für Admins, read-only |
| Rollen & Zugriffsrechte | ✅ MVP | Admin, Verwalter, Leser |
| Ausstattung mitbuchen (Beamer, Musikanlage) | ✅ Phase 2 | Checkboxen im Formular |
| Serientermine | ✅ Phase 2 | z. B. „jeden 1. Dienstag" für Vorstand |
| Online-Zahlung / Kaution | ⏸ später | erstmal Hinweis + Überweisung, Status-Feld im Admin |
| Türschloss/Smart Lock | ⏸ später | Schlüsselübergabe wird stattdessen im Admin dokumentiert |

Erkenntnis aus der Recherche: Puffer sollten **nicht** zur Buchungsdauer addiert und dem Bucher angezeigt werden (das verwirrt). Wir zeigen dem Bucher seine eigene Zeit und markieren die Puffer nur als „Vor-/Nachbereitung" im Kalender.

---

## 3. Buchungsablauf (User Flow)

```
Startseite ──► Kalender: freie Zeiten sehen
    │
    ▼
① Wann?        Datum + Von/Bis (Startdatum wird aus dem Kalender übernommen)
② Was?         Kategorie als große Kacheln + Notizfeld („40. Geburtstag, ca. 35 Gäste")
③ Wer?         Mitglied / Extern, Name, E-Mail, Telefon, (Mannschaft/Abteilung)
④ Bestätigen   Pflicht-Checkboxen  ──► Absenden
    │
    ▼
E-Mail „Bitte bestätige deine Anfrage" (Double-Opt-in, verhindert Fake-Blockaden)
    │
    ▼
Status: ANGEFRAGT  ──► Admins bekommen Mail/Push ──► Bestätigen / Ablehnen
    │
    ▼
BESTÄTIGT ──► Mail mit .ics + Hausordnung ──► Reminder 3 Tage & 24 h vorher
    │
    ▼
Nach dem Termin: „Alles ok?" Mail (Feedback / Schadensmeldung)
```

**Live-Prüfung im Formular:** Sobald Datum, Uhrzeit und Kategorie gewählt sind, prüft das Formular sofort und zeigt grün (frei), gelb (Puffer überschneidet sich, bitte verschieben) oder rot (belegt / Party-Wochenende vergeben). Keine Überraschung erst nach dem Absenden.

### Formularfelder

| Feld | Pflicht | Hinweis |
|---|---|---|
| Datum, Beginn, Ende | ✅ | 15-Minuten-Raster, über Mitternacht möglich (Partys!) |
| Kategorie | ✅ | Kacheln mit Icon, siehe Kapitel 4 |
| Titel / Anlass | ✅ | z. B. „Mannschaftssitzung D2" oder „40. Geburtstag" |
| Notiz | – | Freitext, max. 500 Zeichen |
| Personenzahl (ca.) | ✅ | Warnung über der Raumkapazität |
| Mitglied / Extern | ✅ | bei Mitglied: Mannschaft/Abteilung |
| Name, E-Mail, Telefon | ✅ | Telefon für Rückfragen |
| ☑ **Absprache erfolgt** | ✅ | „Ich habe die Nutzung vorab mit **Michael Grieswelle** oder **Sigrid Brodig** abgesprochen. Ohne vorherige Absprache ist die Buchung ungültig." + Auswahl *mit wem* |
| ☑ Hausordnung & Datenschutz | ✅ | Links öffnen als Overlay |

Die Auswahl „mit wem" hat einen praktischen Nutzen: die genannte Person bekommt die Freigabe-Mail zuerst und kann mit einem Klick bestätigen.

---

## 4. Kategorien & Pufferzeiten

Alle Werte sind im Admin unter *Einstellungen → Kategorien* änderbar.

| Kategorie | Puffer vorher | Puffer nachher | Freigabe nötig? | Zählt als Party |
|---|---|---|---|---|
| Trainer-/Vorstandsbesprechung | 15 min | 15 min | nein (Mitglieder) | – |
| Mannschaftssitzung / Teamabend | 15 min | 30 min | nein (Mitglieder) | – |
| Vereinsveranstaltung | 60 min | 60 min | ja | – |
| Workshop / Schulung | 30 min | 30 min | ja | – |
| **Party / private Feier** | **120 min** | **180 min** | **ja, immer** | **✅** |
| Sonstiges | 30 min | 30 min | ja | – |

### Konfliktregel (so rechnet das System)

Zwei Buchungen kollidieren, wenn der Abstand zwischen ihnen kleiner ist als der **größere** der beiden betroffenen Puffer:

```
Buchung A endet 18:00 (Puffer nachher 30 min)
Buchung B beginnt 18:15 (Puffer vorher 15 min)
Benötigter Abstand = max(30, 15) = 30 min → B frühestens 18:30 ✗
```

Puffer addieren sich also nicht doppelt, und der Raum bleibt trotzdem nie ohne Aufräumzeit.

### Regel: eine Party pro Wochenende

- **Party-Wochenende** = Freitag 12:00 bis Montag 06:00 (einstellbar).
- Liegt eine Party (Status *angefragt* oder *bestätigt*) in diesem Fenster, kann für dasselbe Wochenende **keine weitere Party** angefragt werden. Das Formular zeigt dann: *„Für das Wochenende 14.–16. Nov. ist bereits eine Feier eingetragen. Wähle bitte ein anderes Wochenende."*
- Andere Kategorien (z. B. Mannschaftssitzung am Sonntagvormittag) bleiben möglich, solange Zeit und Puffer passen. **Schalter im Admin:** *„Party sperrt das ganze Wochenende"*, falls ihr am Party-Wochenende gar keine anderen Buchungen wollt.
- Unbestätigte Anfragen verfallen nach 48 h ohne E-Mail-Bestätigung bzw. nach Ablehnung, damit das Wochenende wieder frei wird.
- Im öffentlichen Kalender bekommt ein vergebenes Party-Wochenende ein kleines Party-Badge.

### Weitere Regeln (Vorschlag, alle einstellbar)

- Vorlauf: Partys mindestens 14 Tage, alles andere mindestens 24 h vorher.
- Buchungshorizont: maximal 9 Monate im Voraus.
- Maximale Dauer: 16 h (Partys), 6 h (sonst).
- Ruhezeiten-Hinweis ab 22:00 (Nachbarschaft) als Info im Formular.
- Sperrzeiten durch Admins: Renovierung, Ferien, Vereinsfeste.

---

## 5. Benachrichtigungen

| Auslöser | Empfänger | Inhalt |
|---|---|---|
| Anfrage abgeschickt | Bucher | „Bitte bestätige deine E-Mail" (Double-Opt-in) |
| E-Mail bestätigt | Bucher | Eingangsbestätigung, Status *angefragt*, Storno-Link |
| Neue Anfrage | Admins (Michael, Sigrid, Tom, …) | Zusammenfassung + Buttons **Bestätigen / Ablehnen** direkt aus der Mail |
| Bestätigt | Bucher | Bestätigung, `.ics`-Datei, Hausordnung, Schlüsselübergabe-Info |
| Abgelehnt | Bucher | Begründung (Pflichtfeld für Admin) + Alternativvorschläge |
| Reminder | Bucher | 3 Tage & 24 h vorher: Uhrzeit, Ansprechpartner, Checkliste |
| Reminder | Schlüsselverantwortliche | 24 h vorher: „Morgen Party 18–01 Uhr, Schlüssel an …" |
| Nach Termin | Bucher | „Alles ok?" mit Feedback- und Schadensmeldung |
| Storniert | Bucher + Admins | Info, Slot wird freigegeben |
| Wochen-Digest | Admins | Montag 07:00: alle Buchungen der Woche |

**Kanäle:** E-Mail im MVP. Phase 2: Push über die installierbare Web-App (PWA) oder einen Telegram-/Signal-Bot fürs Orga-Team, dazu ein **iCal-Abo-Link**, damit alle Buchungen direkt im eigenen Handy-Kalender auftauchen.

Absender: `jugendraum@sv-heepen.de` (eigene Domain, SPF/DKIM eingerichtet, damit nichts im Spam landet).

---

## 6. Admin-Bereich

Login per **Magic Link** (E-Mail-Link, kein Passwort zum Vergessen).

### Bereiche

1. **Übersicht (Dashboard)**: offene Anfragen (mit Zähler), heute/diese Woche, nächste Party, Auslastung im Monat.
2. **Anfragen**: Liste der offenen Anfragen mit allen Infos; Bestätigen / Ablehnen / Rückfrage per Klick; Konflikte werden rot markiert.
3. **Kalender**: Monats-, Wochen- und Listenansicht, Puffer schraffiert, Farben nach Kategorie, Drag & Drop zum Verschieben (Bucher wird automatisch informiert).
4. **Buchung anlegen**: Admins können für andere buchen und dabei Regeln übersteuern (wird protokolliert).
5. **Sperrzeiten**: Zeiträume blockieren (Renovierung, Ferien).
6. **Einstellungen**: Kategorien & Puffer, Party-Regel, Vorlaufzeiten, E-Mail-Vorlagen, Empfänger für Benachrichtigungen, Hausordnung (PDF).
7. **Team & Rollen**:
   - **Admin**: alles, inkl. Einstellungen
   - **Verwalter**: Anfragen bearbeiten, Kalender pflegen
   - **Leser**: nur Kalender sehen (z. B. Platzwart, Hausmeister)
8. **Protokoll**: wer hat wann was geändert.
9. **Export**: CSV (Jahresübersicht für den Vorstand), iCal-Feed.

Pro Buchung zusätzlich: interne Notiz, Schlüssel ausgegeben/zurück, Kaution/Miete erhalten (Ja/Nein), Abnahme ok.

---

## 7. Datenschutz & Sicherheit (DSGVO)

- Öffentlicher Kalender zeigt nur **„Belegt"** (optional mit Kategorie), nie Namen oder Notizen.
- Hosting und Datenbank in der EU (z. B. Frankfurt).
- Personenbezogene Daten werden 12 Monate nach dem Termin automatisch gelöscht bzw. anonymisiert (Statistik bleibt).
- Spam-Schutz: Double-Opt-in, Honeypot-Feld, Rate-Limit pro IP, optional Cloudflare Turnstile (ohne Cookie-Banner-Pflicht).
- Datenschutzhinweis und Impressum verlinken auf die Vereinsseite.
- AV-Verträge mit Hosting- und Mail-Anbieter abschließen.

---

## 8. Technik-Empfehlung

Ziel: günstig (0–5 €/Monat), wartungsarm und von Ehrenamtlichen bedienbar.

| Baustein | Empfehlung | Warum |
|---|---|---|
| Frontend + API | **Next.js** (App Router), TypeScript | ein Projekt für Buchungsseite und Admin |
| UI | Tailwind CSS + eigene Komponenten | setzt die Art Direction exakt um |
| Datenbank + Auth | **Supabase** (Postgres, Region Frankfurt) | Magic-Link-Login, Row-Level-Security, kostenloser Tarif reicht |
| Doppelbuchungsschutz | Postgres `EXCLUDE`-Constraint auf `tstzrange` inkl. Puffer + Party-Wochenend-Check in einer Transaktion | Schutz auch bei gleichzeitigen Anfragen |
| E-Mail | Resend oder Brevo (EU) + React-Email-Vorlagen | gute Zustellbarkeit, Vorlagen im Vereinsdesign |
| Reminder | Supabase Cron (pg_cron) oder Vercel Cron, stündlich | verschickt fällige Erinnerungen |
| Hosting | Vercel oder Netlify (EU-Region) | Deployment per Git-Push |
| Kalender-UI | FullCalendar (Admin), eigener schlanker Kalender (öffentlich) | Drag & Drop im Admin |
| Domain | `jugendraum.sv-heepen.de` | Vertrauen und einfacher Link |

### Datenmodell (vereinfacht)

```
categories   id, name, icon, color, buffer_before_min, buffer_after_min,
             requires_approval, is_party, max_duration_min, min_lead_hours

bookings     id, status (pending_email|requested|confirmed|rejected|cancelled),
             category_id, title, note, starts_at, ends_at, guests,
             blocked_range  -- tstzrange inkl. Puffer, für den Constraint
             party_weekend  -- date (Freitag), nur bei Partys, UNIQUE wenn aktiv
             booker_type (member|external), team, name, email, phone,
             agreed_with (grieswelle|brodig), agreed_at,
             manage_token, key_handed_out, deposit_paid, internal_note,
             created_at, confirmed_by, confirmed_at

blackouts    id, starts_at, ends_at, reason
admins       id, email, name, role (admin|manager|viewer), notify (bool)
settings     key, value (z. B. party_blocks_whole_weekend)
audit_log    id, admin_id, booking_id, action, diff, created_at
reminders    id, booking_id, type, send_at, sent_at
```

Die Party-Regel lässt sich direkt in der Datenbank absichern: ein **partieller Unique-Index** auf `party_weekend` für alle Buchungen mit Status `requested` oder `confirmed`. So sind zwei Partys am selben Wochenende auch bei gleichzeitigen Klicks ausgeschlossen.

---

## 9. Art Direction

### Leitidee: „Vereinsheim, aber in gut"

Das Logo liefert alles, was wir brauchen: **Königsblau und Signalgelb**, ein kräftiges **V** und das **Namensband** „HEEPEN". Die Seite soll wirken wie ein gut gemachter Spieltagsflyer: selbstbewusst, sportlich und klar, ohne nach Behördenformular oder Startup-Template auszusehen.

**Drei Stilelemente aus dem Logo:**

1. **Das Band**: blaue Querbalken mit gelber Versalschrift (wie „HEEPEN" im Logo) für Seitentitel, Status-Labels und den Header.
2. **Die V-Diagonale**: Schräge Schnittkanten (Winkel aus dem Logo, ca. 62°) an Hero, Buttons und Abschnittswechseln. Sparsam eingesetzt, eine Diagonale pro Ansicht.
3. **Der Ring**: Der doppelte Kreisrand des Logos wird zum Fokus- und Auswahlring (ausgewählter Tag, aktive Kategorie-Kachel).

### Farben

| Token | Hex | Einsatz |
|---|---|---|
| `--heepen-blau` | `#2E367A` | Primärfarbe, Header, Text auf Gelb |
| `--heepen-gelb` | `#FFD800` | Akzent, Hauptbutton, Auswahl |
| `--nacht` | `#151A3D` | Dark Mode Hintergrund, Footer |
| `--kreide` | `#F5F6FB` | heller Seitenhintergrund (leicht blaustichig) |
| `--linie` | `#D9DCEC` | Rahmen, Trennlinien |
| `--frei` | `#1F9D6B` | Status frei / bestätigt |
| `--hinweis` | `#E08A00` | Puffer / angefragt |
| `--belegt` | `#D64045` | belegt / abgelehnt |

**Kontrastregeln:** Gelb nie als Textfarbe auf Weiß (nicht lesbar). Gelb immer als Fläche mit blauem Text oder als Text auf Blau. Blau auf Weiß und Gelb auf Blau erfüllen WCAG AA.

**Kategoriefarben** (Kalender): Besprechung Blau-hell `#5B67C9`, Mannschaft Türkis `#1F8FA3`, Vereinsevent Blau `#2E367A`, Workshop Violett `#7A5BC9`, Party Gelb `#FFD800` mit blauem Text, Sonstiges Grau-blau `#7A80A6`.

### Typografie

| Rolle | Schrift | Verwendung |
|---|---|---|
| Display | **Archivo** (Expanded/Black, 800–900, Versalien) | Headlines, Band-Labels, große Zahlen; erinnert an Trikotnummern und Vereinsschilder |
| Text | **Source Sans 3** | Fließtext, Formulare; gut lesbar, freundlich |
| Daten | **JetBrains Mono** oder Tabular-Ziffern | Uhrzeiten, Buchungsnummern (`JR-2026-0142`) |

Alle über Google Fonts, oder selbst gehostet (DSGVO-sicherer, empfohlen).

### Formsprache

- Ecken: 6 px bei Eingabefeldern, große Flächen kantig. Keine runden Pillen-Buttons; der Hauptbutton bekommt eine schräge rechte Kante (V-Diagonale).
- Schatten: kaum; Tiefe entsteht über Farbflächen (Blau/Gelb) statt Weichzeichner.
- Icons: Lucide (Linienstärke 2), z. B. `users`, `whistle` → `megaphone`, `party-popper`, `graduation-cap`.
- Fotos: echte Fotos vom Jugendraum und vom Platz (Flutlicht, Vereinsheim), mit Blau-Duoton für Einheitlichkeit. Keine Stockfotos.
- Bewegung: ein Moment, der hängen bleibt. Nach erfolgreicher Anfrage fährt ein „Ticket" mit Buchungsnummer hoch (Spieltagsticket-Optik). Sonst nur kurze 150-ms-Übergänge; `prefers-reduced-motion` wird respektiert.

### Tonalität (Texte)

- **Du-Form**, vereinsnah, kurz: „Wann brauchst du den Raum?" statt „Bitte geben Sie den gewünschten Zeitraum ein".
- Regeln freundlich, aber eindeutig: „Pro Wochenende gibt's nur eine Feier, damit Nachbarn und Raum durchatmen können."
- Fehlermeldungen sagen, was zu tun ist: „Ab 18:30 wäre frei, soll ich das übernehmen?"

### Komponenten (Auswahl)

- **Header-Band**: Logo links (Kreis, 40 px), „Jugendraum" im Band, rechts „Kalender" und „Anfragen".
- **Kategorie-Kacheln**: 2×3-Raster, Icon + Name + Puffer-Info, ausgewählt = Ring + gelbe Fläche.
- **Verfügbarkeits-Ampel**: Live-Leiste unter der Zeitauswahl (frei / Puffer / belegt).
- **Status-Stempel**: Versal-Labels im Band-Stil: `ANGEFRAGT`, `BESTÄTIGT`, `ABGELEHNT`.
- **Buchungsticket**: Bestätigungsansicht und E-Mail mit Perforationslinie, Buchungsnummer, QR-Code für die Verwaltungsseite.

---

## 10. Seitenstruktur

**Öffentlich**
- `/`: Hero (Raumfoto, „Euer Raum. Euer Abend."), Kalender-Vorschau, CTA „Raum anfragen", Eckdaten (Kapazität, Ausstattung, Regeln)
- `/buchen`: das Formular (vier Schritte auf einer Seite, mobil zuerst)
- `/buchung/[token]`: eigene Buchung ansehen, ändern anfragen, stornieren
- `/regeln`: Hausordnung, Party-Regel, FAQ
- `/impressum`, `/datenschutz`

**Admin** (`/admin`)
- Übersicht, Anfragen, Kalender, Sperrzeiten, Einstellungen, Team, Protokoll

---

## 11. Roadmap

| Phase | Umfang | Aufwand (grob) |
|---|---|---|
| **0 – Abstimmung** | Konzept mit Michael & Sigrid durchgehen, offene Fragen klären, Raumfotos machen | 1 Woche |
| **1 – MVP** | Buchungsformular, Regeln (Puffer, Party), Double-Opt-in, Admin: Anfragen + Kalender, Bestätigungs-/Reminder-Mails | 3–4 Wochenenden |
| **2 – Komfort** | iCal-Feed, Drag & Drop, Sperrzeiten, Serientermine, Ausstattung, Wochen-Digest, PWA/Push | 2–3 Wochenenden |
| **3 – Extras** | Kaution/Miete-Tracking, Schlüsselübergabe-Checkliste, Statistik, Feedback-Auswertung | nach Bedarf |

---

## 12. Offene Fragen an den Verein

1. **Party-Wochenende:** Nur weitere Partys sperren (Vorschlag) oder das ganze Wochenende für alle anderen Buchungen?
2. Gilt eine Party unter der Woche (z. B. Feiertag) auch als „Party-Wochenende"?
3. Kostet die Nutzung für Externe etwas (Miete/Kaution)? Unterschied Mitglied/Extern?
4. Wer bekommt welche Benachrichtigungen, und wer gibt Partys frei?
5. Sollen Besprechungen von Mitgliedern automatisch bestätigt werden?
6. Wie groß ist der Raum (max. Personen) und welche Ausstattung gibt es?
7. Wie läuft die Schlüsselübergabe heute?
8. Gibt es eine Subdomain von sv-heepen.de, die wir nutzen dürfen?

---

## Quellen der Recherche

- [Koalendar: Kostenlose Raumbuchungssysteme](https://koalendar.com/de/blog/kostenloses-raumbuchungssystem)
- [OMR Reviews: Raumbuchungssysteme](https://omr.com/de/reviews/category/meeting-room-booking-systems/2)
- [Calendly Hilfe: Verfügbarkeit & Pufferzeiten](https://calendly.com/de/help/availability)
- [GoBright: Buffer time](https://gobright.com/new-features-and-innovation/new-feature-adding-a-buffer-time-to-meeting-rooms/)
- [SuperSaaS: Meeting room booking](https://supersaas.com/info/meeting_room_booking)
- [Jotform: Conference room scheduling](https://www.jotform.com/appointment-scheduling-software/solutions/conference-room)
