# Gästeliste

Mobile Web-App für Gästeliste und Kasse: Gäste eintragen, an der Kasse suchen und einchecken, Anwesenheit auswerten, No-Shows erkennen.

## Rollen

- **Admin** (Anmeldung mit E-Mail und Passwort): Veranstaltungen anlegen, Gäste eintragen und bearbeiten, Ticketarten verwalten, Dashboard, Excel-Export.
- **Kasse** (Link `…/#/kasse` plus 6-stellige PIN): Liste ansehen, suchen, einchecken. Kann nichts eintragen oder löschen.

## Technik

- React + Vite, als PWA installierbar (Home-Bildschirm), läuft nach dem ersten Laden auch offline.
- Firebase Firestore: Echtzeit-Sync zwischen allen Handys, Offline-Cache, Änderungen werden nachgeliefert.
- Firebase Authentication (E-Mail/Passwort). Zugriffsrechte stehen in `firestore.rules`.
- Hosting über GitHub Pages, automatisch bei jedem Push auf `main` (`.github/workflows/deploy.yml`).

## Daten

| Sammlung | Inhalt |
|---|---|
| `events` | Veranstaltung: Name, Datum, Beginn, optional Limit und Deadline |
| `guests` | Gäste-Datenbank: Vorname, Nachname, Telefon, Instagram, Info |
| `entries` | Eintrag eines Gastes auf einer Veranstaltung: Ticketart, Zahlweise, Begleitung, eingetragen von, Check-in-Zeit |
| `ticketTypes` | Ticketarten mit Farbe und Preis (Free, Zahler, VIP / Stage plus eigene) |
| `meta/settings` | Namensvorschläge für „Eingetragen von“ |

Eine Veranstaltung gilt ab 12 Uhr am Folgetag als vorbei. Wer dann nicht eingecheckt ist, zählt als No-Show.

## Einrichtung

1. Firebase-Projekt anlegen, Firestore (Produktionsmodus, `europe-west3`) und Authentication mit E-Mail/Passwort aktivieren.
2. Zwei Nutzer anlegen: Admin-E-Mail und `kasse@gaesteliste.app` (Passwort = Kassen-PIN, 6 Ziffern).
3. Web-App-Konfiguration in `src/config.ts` eintragen, Admin-E-Mail in `src/config.ts` **und** `firestore.rules`.
4. Inhalt von `firestore.rules` in der Firebase-Konsole unter Firestore → Regeln einfügen und veröffentlichen.
5. In GitHub unter Settings → Pages als Quelle „GitHub Actions“ wählen.

## Lokal entwickeln

```bash
npm install
npm run emulators            # Firestore- und Auth-Emulator (braucht Java)
VITE_EMULATOR=1 npm run dev  # App gegen die Emulatoren
```
