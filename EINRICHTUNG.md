# Einrichtung: Jugendraum-Portal selbst online stellen

Diese Anleitung bringt das Portal ohne Programmierkenntnisse ins Netz. Die Seite läuft eigenständig unter einer eigenen Adresse, unabhängig von sv-heepen.de.

**Zeitbedarf:** etwa 45 bis 60 Minuten. **Kosten:** 0 €.

| Baustein | Anbieter | Wofür | Kosten |
|---|---|---|---|
| Code | GitHub (hast du schon) | hier liegt das Projekt | kostenlos |
| Datenbank | Supabase | speichert Buchungen, Team, Einstellungen | kostenlos (Free-Plan) |
| Hosting | Vercel | stellt die Seite ins Netz, startet täglich die Erinnerungen | kostenlos (Hobby-Plan) |
| E-Mails | ein normales Postfach (Gmail, GMX, web.de) | Bestätigungen, Erinnerungen, Anmeldelinks | kostenlos |

Am Ende hast du eine Adresse wie `https://jugendraum-heepen.vercel.app`.

---

## Schritt 1: Zweig auf GitHub in `main` umbenennen

Das Repository hat bisher nur einen Zweig mit einem technischen Namen (`ccr-bb59fbd1-ck1ah3`). Er ist bereits der Standardzweig. Für Übersicht und Vercel benennst du ihn einmal um:

1. Auf GitHub das Repository `Jugendraum-Portal` öffnen.
2. Über der Dateiliste auf den Zweig-Namen bzw. **Branches** klicken.
3. Beim Zweig `ccr-bb59fbd1-ck1ah3` auf das **Stift-Symbol** (Rename branch) klicken und `main` eintragen.

Vercel veröffentlicht später automatisch alles, was auf `main` landet.

## Schritt 2: Datenbank bei Supabase anlegen

1. Auf [supabase.com](https://supabase.com) ein Konto anlegen (Anmeldung mit GitHub geht am schnellsten).
2. **New project** anlegen:
   - Name: `jugendraum`
   - Database Password: ein langes Passwort erzeugen lassen und **sicher notieren**
   - Region: **Central EU (Frankfurt)**
3. Warten, bis das Projekt bereit ist (1–2 Minuten).
4. Links auf **SQL Editor** gehen, **New query**, den kompletten Inhalt der Datei [`db/schema.sql`](db/schema.sql) hineinkopieren und auf **Run** klicken. Es sollte „Success“ erscheinen. Das Skript kann bei späteren Updates einfach erneut ausgeführt werden, es zerstört keine Daten.
5. Oben auf **Connect** klicken und unter **Session pooler** die Verbindungsadresse (URI) kopieren. Sie sieht ungefähr so aus:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   Ersetze `[YOUR-PASSWORD]` durch dein Passwort aus 2. Das ist dein **`DATABASE_URL`**.

> Hinweis: Kostenlose Supabase-Projekte werden pausiert, wenn sie längere Zeit gar nicht genutzt werden. Der tägliche Erinnerungslauf greift jeden Tag auf die Datenbank zu. Falls das Projekt trotzdem einmal pausiert ist, kannst du es im Supabase-Dashboard mit einem Klick wieder starten.

## Schritt 3: Mailversand vorbereiten (eigenes Postfach)

Am einfachsten ist ein **eigenes Postfach nur für den Jugendraum**, zum Beispiel `jugendraum.heepen@gmail.com`. So landen Antworten nicht in deinem privaten Postfach.

**Gmail (empfohlen):**
1. Neues Google-Konto anlegen.
2. Im Google-Konto unter **Sicherheit** die **Bestätigung in zwei Schritten** einschalten (ohne geht Schritt 3 nicht).
3. Unter [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) ein **App-Passwort** erstellen (Name z. B. „Jugendraum“). Du bekommst 16 Zeichen, die notierst du ohne Leerzeichen.
4. Deine Werte:
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=jugendraum.heepen@gmail.com`, `SMTP_PASS=` das App-Passwort.

**GMX oder web.de:** In den Postfach-Einstellungen unter „POP3/IMAP Abruf“ den Zugriff erlauben. Dann:
`SMTP_HOST=mail.gmx.net` (bzw. `smtp.web.de`), `SMTP_PORT=587`, `SMTP_USER=` deine Adresse, `SMTP_PASS=` dein Passwort.

> Gmail erlaubt etwa 500 Empfänger pro Tag. Für einen Jugendraum reicht das um ein Vielfaches.

## Schritt 4: Seite bei Vercel veröffentlichen

1. Auf [vercel.com](https://vercel.com) mit GitHub anmelden (Hobby-Plan).
2. **Add New → Project**, das Repository `Jugendraum-Portal` auswählen, **Import**.
3. Projektname vergeben, z. B. `jugendraum-heepen`. Daraus wird die Adresse `https://jugendraum-heepen.vercel.app`.
4. Unter **Environment Variables** diese Werte eintragen (Name links, Wert rechts):

| Name | Wert |
|---|---|
| `DATABASE_URL` | aus Schritt 2.5 |
| `APP_URL` | `https://jugendraum-heepen.vercel.app` (deine Adresse, ohne `/` am Ende) |
| `SESSION_SECRET` | ein langer Zufallswert, mind. 32 Zeichen (z. B. zwei UUIDs von [uuidgenerator.net](https://www.uuidgenerator.net) hintereinander) |
| `CRON_SECRET` | ein weiterer, anderer Zufallswert |
| `INITIAL_ADMIN_EMAIL` | **deine** E-Mail-Adresse |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | aus Schritt 3 |
| `MAIL_FROM` | optional, z. B. `Jugendraum SV Heepen <jugendraum.heepen@gmail.com>` (muss zum Postfach passen) |

5. **Deploy** klicken und warten (2–3 Minuten).

Der tägliche Erinnerungslauf (06:00 Uhr UTC, also 7 bzw. 8 Uhr deutscher Zeit) ist in `vercel.json` hinterlegt und wird von Vercel automatisch eingerichtet.

> Du hast die Umgebungsvariablen erst nach dem ersten Deploy eingetragen? Dann unter **Deployments** beim neuesten Eintrag auf **⋯ → Redeploy** klicken, damit sie wirksam werden.

## Schritt 5: Erste Anmeldung

1. `https://jugendraum-heepen.vercel.app/admin` öffnen.
2. Deine Adresse aus `INITIAL_ADMIN_EMAIL` eingeben. Du bekommst einen Anmeldelink per Mail (auch im Spam nachsehen).
3. Nach dem Klick bist du Admin. Ab jetzt gilt `INITIAL_ADMIN_EMAIL` nicht mehr; weitere Personen fügst du unter **Team** hinzu.

## Schritt 6: Einrichten in der Verwaltung

Unter **Einstellungen**:
- **Mailversand:** „Testmail senden“ klicken und prüfen, ob sie ankommt.
- **Betreiber und Impressum:** Name, Anschrift und E-Mail eintragen. Da die Seite nicht auf der Vereinsdomain läuft, braucht sie ein **eigenes Impressum**. Der Betreiber ist die Person oder der Verein, der die Seite verantwortet. Im Zweifel mit dem Vorstand klären.
- **Regeln**, **Ausstattung und Kosten**, **E-Mail-Texte** nach euren Wünschen anpassen.

Außerdem:
- Unter **Team** deinen Namen ändern und Michael Grieswelle, Sigrid Brodig und weitere Personen anlegen.
- Unter **Sperrzeiten** feste Ruhetage oder Ferien eintragen.
- Unter **Team** deinen persönlichen **Kalender-Abo-Link** ins Handy übernehmen.

Die Übersicht zeigt unter „Zu erledigen“ an, solange Mailversand oder Impressum noch fehlen.

## Schritt 7: Testen

1. Im privaten Browserfenster eine Anfrage stellen (mit deiner eigenen Adresse als Bucher).
2. Bestätigungslink aus der Mail klicken.
3. In der Verwaltung bestätigen. Die Bestätigung mit Kalenderdatei sollte ankommen.
4. Testbuchung wieder stornieren.

Danach kannst du den Link verteilen.

---

## Später: Updates einspielen

Neue Versionen landen per Pull Request auf `main`. Vercel veröffentlicht sie automatisch (Änderungen auf anderen Zweigen bekommen nur eine Vorschau-Adresse). Wenn sich `db/schema.sql` geändert hat, das Skript wie in Schritt 2.4 einmal erneut im SQL Editor ausführen.

## Optional: eigene Adresse statt .vercel.app

Eine eigene Domain wie `jugendraum-heepen.de` kostet bei üblichen Anbietern etwa 1 € im Monat. In Vercel unter **Settings → Domains** hinzufügen und den angezeigten DNS-Eintrag beim Domain-Anbieter setzen. Danach `APP_URL` anpassen und neu deployen. Mit eigener Domain kannst du statt Gmail auch Resend nutzen (`RESEND_API_KEY`), dann kommen die Mails von einer Adresse wie `jugendraum@jugendraum-heepen.de`.

## Hilfe bei Problemen

| Problem | Lösung |
|---|---|
| Seite zeigt „Application error“ | In Vercel unter **Logs** nachsehen. Meist ist `DATABASE_URL` falsch (Passwort nicht ersetzt?) oder das Schema aus Schritt 2.4 fehlt. |
| Kein Anmeldelink | Einstellungen werden erst nach Login sichtbar, daher: in Vercel prüfen, ob alle `SMTP_…`-Werte stimmen, dann Redeploy. Bei Gmail muss es das App-Passwort sein, nicht das normale Passwort. |
| Mails landen im Spam | Bei Gmail einmal „Kein Spam“ markieren. Dauerhaft hilft eine eigene Domain mit Resend. |
| Erinnerungen kommen nicht | In Vercel unter **Settings → Cron Jobs** prüfen, ob der Job läuft, und ob `CRON_SECRET` gesetzt ist. |
| Daten sichern | In der Verwaltung unter **Buchungen** (Zeitraum „Alle“) regelmäßig die CSV-Datei exportieren. Welche automatischen Sicherungen Supabase im jeweiligen Tarif anbietet, steht im Dashboard unter **Database → Backups**. |
