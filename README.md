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

### 2. ADP-Daten befüllen (bereits erledigt)

`adp.json` ist bereits mit den Top 199 Spielern aus den FantasyCalc Redraft
Rankings befüllt (Mapping `sleeperId -> overallRank`). Das deckt die
Trigger `value_pick`, `reach_pick` und `star_player` für praktisch jeden
Pick ab, der in einem Standard-Draft überhaupt relevant wird.

**Wenn eine neue Saison beginnt oder sich die Werte stark ändern**, einfach
eine aktuelle CSV mit den Spalten `sleeperId` und `overallRank` besorgen
und dieses Python-Snippet erneut laufen lassen:

```python
import csv, json

with open('neue_liste.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f, delimiter=';'))

adp = {r['sleeperId'].strip(): int(r['overallRank']) for r in rows}
with open('adp.json', 'w', encoding='utf-8') as f:
    json.dump(adp, f, ensure_ascii=False, indent=2)
```

Passe außerdem `thresholds.adpCoverageRange` in `config.js` an, falls die
neue Liste mehr oder weniger als 199 Spieler enthält – dieser Wert steuert,
ab welchem Pick ein "nicht in der Liste"-Spieler noch als `surprise_pick`
zählt (danach sind fehlende Einträge einfach normale Spätpicks).

### 3. Roster-Bedarf (automatisch, kein Setup nötig)

`roster_need_filled` funktioniert jetzt vollautomatisch: Die App liest beim
Start die Starter-Slots deiner Liga direkt aus den Sleeper-Draft-Settings
(`slots_qb`, `slots_rb`, `slots_wr`, `slots_te`, `slots_flex` ...) und
verfolgt während des Drafts live, welche Positionen jedes Team schon
besetzt hat. Ein Pick gilt als "Bedarf gefüllt", wenn er eine noch offene
Starter-Position schließt (inkl. Flex-Logik für RB/WR/TE).

Kein manueller Eintrag mehr nötig – funktioniert für jede Liga-Größe und
jedes Lineup-Format automatisch.

### 4. Rivalitäten eintragen (optional, manuell)

Rivalitäten lassen sich nicht automatisch ableiten – das musst du einmalig
selbst in `config.js` eintragen. Damit du dafür nicht mühsam roster_ids
heraussuchen musst: Wenn du die App zum ersten Mal startest und eine
`leagueId` in `config.js` eingetragen hast, listet das Debug-Log unten auf
der Seite automatisch alle Teams mit ihrer roster_id auf, z. B.:

```
roster_id 1 = "Team Mustermann"
roster_id 4 = "Team Beispiel"
```

Diese IDs trägst du dann in `config.js` unter `rivalries` ein:

```js
rivalries: {
  "1": "4",
  "4": "1"
}
```

### 5. Clock Pressure (automatisch, mit einer bekannten Einschränkung)

`clock_pressure` berechnet jetzt korrekt, welches Team gerade an der Reihe
ist – basierend auf Pick-Nummer, Team-Anzahl und Snake-Reihenfolge
(`slot_to_roster_id` aus den Sleeper-Draft-Settings). Der Countdown selbst
läuft lokal im Browser ab dem Zeitpunkt, an dem die App den letzten Pick
erkannt hat.

**Bekannte Einschränkung:** "3rd Round Reversal"-Drafts (bei denen die
Snake-Reihenfolge in einer bestimmten Runde nochmal gedreht wird) werden
nicht speziell behandelt. Für die meisten Standard-Snake-Drafts passt die
Berechnung aber genau.

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

- **clock_pressure** geht von einem normalen Snake-Draft aus. "3rd Round
  Reversal" oder andere Sonderformate werden nicht separat behandelt (siehe
  Abschnitt 5 oben).
- Wenn du die Show mitten im Draft startest, lädt die App beim ersten
  Poll-Zyklus alle bisherigen Picks still nach (kein Kommentar, kein Ton),
  um Roster-Zähler und Position-Run-Historie korrekt zu initialisieren.
  Erst danach wird live kommentiert – das kann beim allerersten Laden ein
  bis zwei Sekunden dauern, ist aber normal.
- Die Stimmqualität der Web Speech API hängt stark vom Browser/Betriebssystem
  ab (Chrome auf Desktop hat i. d. R. die meisten/besten deutschen Stimmen).
- Spielername und Position kommen direkt aus den Pick-Metadaten von Sleeper
  (`pick.metadata`), nicht aus dem großen `/v1/players/nfl`-Datensatz. Dieser
  ist absichtlich nicht eingebunden: Sleeper gibt selbst an, ihn höchstens
  einmal pro Tag abzurufen, und die direkte Browser-Anfrage schlägt wegen
  fehlender CORS-Freigabe ohnehin fehl. Die Pick-Metadaten reichen für alle
  Trigger in diesem Projekt völlig aus.
- **Nicht jeder Pick bekommt einen Kommentar.** Das ist Absicht: Ein Pick,
  der genau nach Plan läuft (keine besondere ADP-Abweichung, keine offene
  Starter-Lücke, kein Run, keine Rivalität), löst bewusst keinen Trigger
  aus. Alles zu kommentieren würde jeden Pick künstlich zur "Überraschung"
  aufblasen. Im Debug-Log siehst du trotzdem jeden Pick, nur ohne
  Sprachausgabe.
- **Mock-Drafts liefern oft keine `roster_id`**, nur `picked_by` (User-ID).
  Die App fängt das ab (`getTeamKey` in `app.js`) und nutzt dann die
  User-ID als Ersatz-Schlüssel für Team-Zuordnung und Roster-Bedarf. Echte
  Liga-Drafts sind davon nicht betroffen.

## Nächste Ausbaustufen (Ideen)

- `players.json`-Cache serverseitig vorbauen, um den initialen Ladevorgang
  zu beschleunigen (aktuell wird das komplette Sleeper-Spielerregister im
  Browser gecacht, ca. 5 MB, erster Aufruf kann etwas dauern).
- Optionaler Live-LLM-Call nur für besonders wichtige Momente (siehe
  vorherige Konversation) als Ergänzung zu den Templates.
- Automatische roster_need-Erkennung basierend auf Standard-Lineup-Slots.
