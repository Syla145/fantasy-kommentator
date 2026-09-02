// ============================================================
// APP – verbindet Sleeper, Templates und Speech zur Live-Show
// ============================================================

const App = (() => {
  let draftMeta = null;
  let teamNames = {};
  let players = {};
  let adp = {};
  let seenPickIds = new Set();
  let recentPositions = []; // für position_run
  let totalPicks = null;
  let clockAnnouncedForPick = new Set();
  let pollTimer = null;
  let clockTimer = null;

  function log(msg) {
    const el = document.getElementById("log");
    const line = document.createElement("div");
    line.textContent = msg;
    el.prepend(line);
  }

  function transcriptLine(host, text) {
    const el = document.getElementById("transcript");
    const line = document.createElement("div");
    line.className = `line ${host}`;
    line.innerHTML = `<strong>${host.toUpperCase()}:</strong> ${text}`;
    el.prepend(line);
  }

  async function loadAdp() {
    try {
      const res = await fetch("adp.json");
      adp = await res.json();
    } catch (e) {
      log("Keine adp.json gefunden – value_pick/reach_pick/star_player werden übersprungen.");
      adp = {};
    }
  }

  function buildContext(pick) {
    const player = players[pick.player_id] || {};
    const playerName = player.full_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unbekannter Spieler";
    const team = teamNames[pick.roster_id] || pick.picked_by || `Team ${pick.roster_id}`;
    const position = player.position || pick.metadata?.position || "?";
    const pickAdp = adp[pick.player_id];
    const rivalRosterId = CONFIG.rivalries[pick.roster_id];
    const rival = rivalRosterId ? teamNames[rivalRosterId] : null;

    return {
      team,
      player: playerName,
      position,
      pick_number: pick.pick_no,
      adp: pickAdp !== undefined ? pickAdp : "",
      round: pick.round,
      rival: rival || "",
      seconds: "" // wird nur bei clock_pressure separat gesetzt
    };
  }

  function detectTriggers(pick, context) {
    const triggers = [];
    const th = CONFIG.thresholds;

    if (pick.pick_no === 1) triggers.push("first_pick");
    if (totalPicks && pick.pick_no === totalPicks) triggers.push("last_pick");

    const pickAdp = adp[pick.player_id];
    if (pickAdp !== undefined) {
      if (pickAdp <= th.starPlayerAdp) triggers.push("star_player");
      if (pickAdp - pick.pick_no >= th.valuePickDiff) triggers.push("value_pick");
      if (pick.pick_no - pickAdp >= th.reachPickDiff) triggers.push("reach_pick");
    } else if (
      Object.keys(adp).length > 0 &&
      pick.pick_no <= th.adpCoverageRange
    ) {
      // Spieler fehlt in der ADP-Liste, obwohl der Pick noch im Bereich liegt,
      // in dem die Liste eigentlich Spieler abdeckt -> echte Überraschung.
      // Späte Picks jenseits der Liste sind dagegen normal, kein surprise_pick.
      triggers.push("surprise_pick");
    }

    // Position-Run prüfen
    recentPositions.push(context.position);
    if (recentPositions.length > th.positionRunLength) recentPositions.shift();
    if (
      recentPositions.length === th.positionRunLength &&
      recentPositions.every(p => p === context.position)
    ) {
      triggers.push("position_run");
    }

    // Roster-Bedarf (nur wenn in config.js gepflegt)
    const needs = CONFIG.rosterNeeds[pick.roster_id];
    if (needs && needs.includes(context.position)) {
      triggers.push("roster_need_filled");
    }

    // Rivalität
    if (context.rival) triggers.push("rivalry_pick");

    return triggers.length > 0 ? triggers : ["surprise_pick"];
  }

  function announcePick(pick) {
    const context = buildContext(pick);
    const triggers = detectTriggers(pick, context);

    // Aus allen zutreffenden Triggern zufällig einen für den Kommentar wählen,
    // first_pick/last_pick haben Vorrang, da sie selten sind.
    let trigger = triggers.includes("first_pick")
      ? "first_pick"
      : triggers.includes("last_pick")
      ? "last_pick"
      : triggers[Math.floor(Math.random() * triggers.length)];

    const result = Templates.generate(trigger, context);
    if (!result) return;
    Speech.say(result.host, result.text);
    log(`Pick ${pick.pick_no}: ${context.player} (${context.position}) -> ${context.team} | Trigger: ${trigger}`);
  }

  function checkClockPressure() {
    if (!draftMeta || !draftMeta.settings || !draftMeta.settings.pick_timer) return;
    // Vereinfachtes Modell: Sleeper liefert im Draft-Objekt "last_picked"
    // (Timestamp des letzten Picks). Daraus schätzen wir die Restzeit
    // für den aktuellen Pick.
    const timerSeconds = draftMeta.settings.pick_timer;
    const lastPicked = draftMeta.last_picked || Date.now();
    const elapsed = (Date.now() - lastPicked) / 1000;
    const remaining = Math.max(0, Math.round(timerSeconds - elapsed));
    const currentPickNo = seenPickIds.size + 1;

    if (
      remaining > 0 &&
      remaining <= CONFIG.thresholds.clockPressureSeconds &&
      !clockAnnouncedForPick.has(currentPickNo)
    ) {
      clockAnnouncedForPick.add(currentPickNo);
      // Team, das aktuell dran ist, lässt sich aus draft_order/slot ableiten -
      // hier vereinfacht als Platzhalter, siehe README für Erweiterung.
      const context = { team: "Das aktuelle Team", seconds: remaining };
      const result = Templates.generate("clock_pressure", context);
      if (result) {
        Speech.say(result.host, result.text);
        log(`Clock Pressure: noch ${remaining}s`);
      }
    }
  }

  async function pollPicks() {
    try {
      const picks = await Sleeper.getPicks(CONFIG.draftId);
      for (const pick of picks) {
        const id = `${pick.pick_no}-${pick.player_id}`;
        if (!seenPickIds.has(id)) {
          seenPickIds.add(id);
          announcePick(pick);
        }
      }
    } catch (e) {
      log(`Fehler beim Abrufen der Picks: ${e.message}`);
    }
  }

  async function start() {
    document.getElementById("startBtn").disabled = true;
    log("Lade Daten...");

    Speech.setOnLine(transcriptLine);

    await Templates.load("templates.json");
    await loadAdp();

    players = await Sleeper.getPlayers();
    log(`Spieler-Datenbank geladen (${Object.keys(players).length} Spieler).`);

    teamNames = await Sleeper.buildTeamNameMap(CONFIG.leagueId);

    draftMeta = await Sleeper.getDraft(CONFIG.draftId);
    if (draftMeta.settings && draftMeta.settings.teams && draftMeta.settings.rounds) {
      totalPicks = draftMeta.settings.teams * draftMeta.settings.rounds;
    }

    log("Setup fertig. Show läuft...");

    pollTimer = setInterval(pollPicks, CONFIG.pollIntervalMs);
    clockTimer = setInterval(checkClockPressure, 1000);
    pollPicks();
  }

  function stop() {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
    document.getElementById("startBtn").disabled = false;
    log("Show gestoppt.");
  }

  return { start, stop };
})();
