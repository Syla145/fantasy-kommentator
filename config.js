// ============================================================
// KONFIGURATION – hier alles eintragen, was pro Liga/Draft nötig ist
// ============================================================

const CONFIG = {
  // Sleeper Draft-ID (findest du in der URL deines Drafts auf sleeper.com)
  draftId: "1400816117244563456",

  // Sleeper League-ID (für Teamnamen/Owner) – optional, aber empfohlen
  leagueId: "1389695005928464384",

  // Wie oft wird bei Sleeper nach neuen Picks gefragt (Millisekunden)
  pollIntervalMs: 4000,
 
  // Schwellenwerte für die Trigger-Erkennung
  thresholds: {
    valuePickDiff: 24,      // ADP - pick_number >= X  -> value_pick
    reachPickDiff: 24,      // pick_number - ADP >= X  -> reach_pick
    starPlayerAdp: 15,      // ADP <= X -> star_player
    positionRunLength: 3,   // X gleiche Positionen in Folge -> position_run
    clockPressureSeconds: 12, // verbleibende Sekunden -> clock_pressure
    adpCoverageRange: 199   // bis zu diesem Pick gilt "fehlt in adp.json" als Überraschung
                             // (entspricht der Anzahl Spieler in adp.json - anpassen,
                             // falls du eine längere/kürzere Liste nutzt)
  },
 
  // Rivalitäten: roster_id (aus Sleeper) -> roster_id des Rivalen
  // roster_id + Teamname bekommst du bequem über die Konsolen-Ausgabe,
  // die die App beim Start macht (siehe README, Abschnitt "Rivalitäten
  // eintragen") oder direkt über /v1/league/{leagueId}/rosters.
  // Beispiel: { "1": "4", "4": "1" }  (Team 1 und Team 4 sind Rivalen)
  rivalries: {
    // "1": "4",
    // "4": "1"
  },
 
  // roster_need_filled läuft jetzt automatisch: die App liest die
  // Starter-Anforderungen direkt aus den Sleeper-Draft-Settings
  // (slots_qb, slots_rb, slots_wr, slots_te, slots_flex ...) und erkennt
  // selbst, wenn ein Pick eine noch offene Starter-Position schließt.
  // Kein manueller Eintrag mehr nötig.
 
  // Stimmen-Einstellungen für die beiden Hosts (Web Speech API)
  voices: {
    kevin: { pitch: 0.85, rate: 1.15, preferLang: "de-DE" },
    jeremy: { pitch: 1.15, rate: 1.0, preferLang: "de-DE" }
  }
};
 
