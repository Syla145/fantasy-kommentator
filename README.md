# Fantasy Draft Channel (DIY)

Eigene Live-Kommentar-Show für deinen Sleeper-Fantasyfootball-Draft. Läuft komplett
im Browser, kein Backend nötig, kostenlos auf GitHub Pages hostbar.

## Wie es funktioniert

1. `app.js` pollt regelmäßig die öffentliche Sleeper-API nach neuen Draft-Picks.
2. Für jeden neuen Pick wird per Regel-Logik ein "Trigger" erkannt
   (z. B. `value_pick`, `position_run`, `first_pick` ...).
3. Aus `templates.json` wird eine passende, vorgefertigte Kommentar-Zeile für
   einen der beiden Hosts (Kevin/Jeremy) ausgewählt und die Platzhalter
   (`{team}`, `{player}` ...) mit den echten Draft-Daten befüllt.
4. Der Text wird per Web Speech API (`speech.js`) vorgelesen.

Kein Server, keine laufenden API-Kosten, kein LLM-Call zur Laufzeit.

## Setup

### 1. Draft- und League-ID herausfinden

Öffne deinen Draft auf sleeper.com/sleeper-App. Die URL sieht z. B. so aus:

```
https://sleeper.com/draft/nfl/123456789012345678
```

Die lange Zahl am Ende ist deine `draftId`. Die `leagueId` findest du analog in
der URL deiner Liga (`.../leagues/<leagueId>/...`).

Beide Werte trägst du in `config.js` ein.

### 2. ADP-Daten befüllen (optional, aber empfohlen)

Ohne ADP-Daten funktionieren die Trigger `value_pick`, `reach_pick` und
`star_player` nicht (sie werden einfach übersprungen, alles andere läuft trotzdem).

So befüllst du `adp.json`:
1. Eine ADP-Liste besorgen (z. B. von FantasyPros, als CSV/Tabelle exportierbar).
2. Sleeper player_ids gibt es unter `https://api.sleeper.app/v1/players/nfl`
   (großes JSON, im Browser mit Strg+F nach Spielernamen suchen).
3. Ein Mapping `"player_id": adp_wert` in `adp.json` eintragen.

Für den Prototypen reicht auch eine kleine Liste mit nur den Top 50-100 Spielern.

### 3. Rivalitäten & Team-Bedarfe (optional)

In `config.js`:
- `rivalries`: roster_id -> roster_id des Rivalen (für den `rivalry_pick`-Trigger)
- `rosterNeeds`: roster_id -> Liste benötigter Positionen (für `roster_need_filled`)

roster_ids bekommst du über `https://api.sleeper.app/v1/league/<leagueId>/rosters`.

### 4. Lokal testen

Da die Seite `fetch()` für lokale Dateien (`templates.json`, `adp.json`) nutzt,
brauchst du einen simplen lokalen Webserver (nicht einfach die `index.html`
per Doppelklick öffnen):

```bash
# Python
python3 -m http.server 8000

# oder Node
npx serve .
```

Dann `http://localhost:8000` öffnen und auf "Show starten" klicken.

**Wichtig:** Browser blockieren automatisch abspielende Sprachausgabe ohne
Nutzer-Interaktion. Der "Show starten"-Button ist genau dafür da – er zählt
als Nutzer-Geste und schaltet die Sprachausgabe frei.

## Deployment auf GitHub Pages

1. Alle Dateien in ein neues GitHub-Repo pushen.
2. Im Repo: Settings -> Pages -> Branch auswählen (meist `main`), Ordner `/root`.
3. Nach ein bis zwei Minuten ist die Seite unter
   `https://<dein-username>.github.io/<repo-name>/` erreichbar.
4. Diese URL auf dem TV/Laptop öffnen, "Show starten" klicken, Draft beginnen.

## Bekannte Einschränkungen im aktuellen Grundgerüst

- **clock_pressure** ist aktuell vereinfacht: Sleeper liefert im Draft-Objekt
  keinen expliziten "wer ist gerade dran"-Wert für Snake-Drafts sehr zuverlässig
  mit; der aktuelle Code nutzt `last_picked` als Näherung. Für eine robustere
  Lösung müsste man `draft_order` + `slot_to_roster_id` + Pick-Reihenfolge
  selbst durchrechnen, um pro Pick das genaue "on the clock"-Team zu bestimmen.
- **roster_need_filled** erkennt Bedarf nur, wenn du ihn manuell in
  `rosterNeeds` einträgst. Eine automatische Ableitung aus dem bisherigen
  Kader (z. B. "Team hat noch keinen TE") wäre der nächste Ausbauschritt.
- Die Stimmqualität der Web Speech API hängt stark vom Browser/Betriebssystem
  ab (Chrome auf Desktop hat i. d. R. die meisten/besten deutschen Stimmen).

## Nächste Ausbaustufen (Ideen)

- `players.json`-Cache serverseitig vorbauen, um den initialen Ladevorgang
  zu beschleunigen (aktuell wird das komplette Sleeper-Spielerregister im
  Browser gecacht, ca. 5 MB, erster Aufruf kann etwas dauern).
- Optionaler Live-LLM-Call nur für besonders wichtige Momente (siehe
  vorherige Konversation) als Ergänzung zu den Templates.
- Automatische roster_need-Erkennung basierend auf Standard-Lineup-Slots.
