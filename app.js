// ============================================================
// APP – verbindet Sleeper, Templates und Speech zur Live-Show
// ============================================================

const App = (() => {
  let draftMeta = null;
  let teamNames = {};
  let adp = {};
  let seenPickIds = new Set();
  let recentPositions = []; // für position_run
  let totalPicks = null;
  let clockAnnouncedForPick = new Set();
  let pollTimer = null;
  let clockTimer = null;
  let initializing = true; // true während des stillen Nachladens bestehender Picks
  let lastPickAt = Date.now(); // lokaler Zeitstempel für clock_pressure
  let starterRequirements = {}; // Position -> Anzahl Starter-Slots (ohne Flex)
  let flexSlots = 0; // RB/WR/TE-Flex-Slots
  let rosterPositionCounts = {}; // roster_id -> {QB: n, RB: n, ...}

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

  // Liest die Starter-Anforderungen direkt aus den Sleeper-Draft-Settings,
  // damit roster_need_filled ohne manuelle Konfiguration funktioniert.
  function buildStarterRequirements(settings) {
    starterRequirements = {
      QB: settings.slots_qb || 0,
      RB: settings.slots_rb || 0,
      WR: settings.slots_wr || 0,
      TE: settings.slots_te || 0,
      DEF: settings.slots_def || 0,
      K: settings.slots_k || 0
    };
    flexSlots = settings.slots_flex || 0;
    // Superflex zählt zusätzlich als "irgendein Offensiv-Slot" - vereinfacht
    // hier mit in den Flex-Pool gepackt, da Sonderfall selten ist.
    if (settings.slots_super_flex) flexSlots += settings.slots_super_flex;
  }

  function ensureRosterCounts(rosterId) {
    if (!rosterPositionCounts[rosterId]) {
      rosterPositionCounts[rosterId] = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0, K: 0 };
    }
    return rosterPositionCounts[rosterId];
  }

  // Prüft, ob dieser Pick eine noch offene Starter-Lücke schließt.
  // Muss VOR dem Hochzählen von rosterPositionCounts aufgerufen werden.
  function fillsRosterNeed(rosterId, position) {
    const counts = ensureRosterCounts(rosterId);
    const base = starterRequirements[position] || 0;
    if ((counts[position] || 0) < base) return true;

    if (["RB", "WR", "TE"].includes(position)) {
      const flexTotal = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0);
      const flexRequired =
        (starterRequirements.RB || 0) +
        (starterRequirements.WR || 0) +
        (starterRequirements.TE || 0) +
        flexSlots;
      if (flexTotal < flexRequired) return true;
    }
    return false;
  }

  function recordRosterPick(rosterId, position) {
    const counts = ensureRosterCounts(rosterId);
    if (counts[position] !== undefined) counts[position] += 1;
  }

  function buildContext(pick) {
    const meta = pick.metadata || {};
    const playerName =
      `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || "Unbekannter Spieler";
    const team = teamNames[pick.roster_id] || pick.picked_by || `Team ${pick.roster_id}`;
    const position = meta.position || "?";
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

    // Roster-Bedarf: automatisch aus den Draft-Settings + bisherigen Picks
    // des Teams abgeleitet, kein manueller Eintrag mehr nötig.
    if (starterRequirements[context.position] !== undefined && fillsRosterNeed(pick.roster_id, context.position)) {
      triggers.push("roster_need_filled");
    }

    // Rivalität (weiterhin manuell in config.js gepflegt)
    if (context.rival) triggers.push("rivalry_pick");

    return triggers.length > 0 ? triggers : ["surprise_pick"];
  }

  function announcePick(pick, options) {
    const silent = options && options.silent;
    const context = buildContext(pick);
    const triggers = detectTriggers(pick, context);

    // Roster-Zähler erst NACH der Bedarfsprüfung hochzählen
    recordRosterPick(pick.roster_id, context.position);

    if (silent) return; // beim Nachladen bestehender Picks nicht sprechen

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

  // Bestimmt roster_id, Runde und Slot des Teams, das gerade dran ist.
  // Berücksichtigt Snake-Reihenfolge (ungerade Runde vorwärts, gerade rückwärts).
  // Reversal-Round-Sonderfälle werden bewusst nicht abgebildet (siehe README).
  function computeOnTheClock(nextPickNumber) {
    if (!draftMeta || !draftMeta.settings || !draftMeta.slot_to_roster_id) return null;
    const teams = draftMeta.settings.teams;
    if (!teams || !totalPicks || nextPickNumber > totalPicks) return null;

    const round = Math.ceil(nextPickNumber / teams);
    const indexInRound = (nextPickNumber - 1) % teams; // 0-basiert

    let slot;
    if (draftMeta.type === "linear") {
      slot = indexInRound + 1;
    } else {
      // snake (Standardfall)
      slot = round % 2 === 1 ? indexInRound + 1 : teams - indexInRound;
    }

    const rosterId = draftMeta.slot_to_roster_id[slot] ?? draftMeta.slot_to_roster_id[String(slot)];
    return { rosterId, round, slot };
  }

  function checkClockPressure() {
    if (initializing) return;
    if (!draftMeta || !draftMeta.settings || !draftMeta.settings.pick_timer) return;

    const timerSeconds = draftMeta.settings.pick_timer;
    const elapsed = (Date.now() - lastPickAt) / 1000;
    const remaining = Math.max(0, Math.round(timerSeconds - elapsed));
    const nextPickNumber = seenPickIds.size + 1;

    if (
      remaining > 0 &&
      remaining <= CONFIG.thresholds.clockPressureSeconds &&
      !clockAnnouncedForPick.has(nextPickNumber)
    ) {
      const onClock = computeOnTheClock(nextPickNumber);
      if (!onClock) return;
      clockAnnouncedForPick.add(nextPickNumber);

      const team = teamNames[onClock.rosterId] || `Team ${onClock.rosterId}`;
      const context = { team, seconds: remaining };
      const result = Templates.generate("clock_pressure", context);
      if (result) {
        Speech.say(result.host, result.text);
        log(`Clock Pressure: ${team} hat noch ${remaining}s`);
      }
    }
  }

  async function pollPicks() {
    try {
      const picks = await Sleeper.getPicks(CONFIG.draftId);
      let newPickFound = false;
      for (const pick of picks) {
        const id = `${pick.pick_no}-${pick.player_id}`;
        if (!seenPickIds.has(id)) {
          seenPickIds.add(id);
          announcePick(pick, { silent: initializing });
          if (!initializing) newPickFound = true;
        }
      }
      if (initializing) {
        initializing = false;
        lastPickAt = Date.now();
        log(`${seenPickIds.size} bestehende Picks geladen, ab jetzt live.`);
      } else if (newPickFound) {
        lastPickAt = Date.now();
        clockAnnouncedForPick.clear(); // neuer Pick -> neuer Countdown möglich
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

    teamNames = await Sleeper.buildTeamNameMap(CONFIG.leagueId);
    if (Object.keys(teamNames).length > 0) {
      log("Team-Übersicht für rivalries/rosterNeeds in config.js:");
      Object.entries(teamNames).forEach(([rosterId, name]) => {
        log(`  roster_id ${rosterId} = "${name}"`);
      });
    }

    draftMeta = await Sleeper.getDraft(CONFIG.draftId);
    if (draftMeta.settings && draftMeta.settings.teams && draftMeta.settings.rounds) {
      totalPicks = draftMeta.settings.teams * draftMeta.settings.rounds;
    }
    if (draftMeta.settings) buildStarterRequirements(draftMeta.settings);

    log("Setup fertig. Lade bestehende Picks (still, ohne Kommentar)...");

    pollTimer = setInterval(pollPicks, CONFIG.pollIntervalMs);
    clockTimer = setInterval(checkClockPressure, 1000);
    await pollPicks(); // erster Durchlauf: bestehende Picks still nachladen
  }

  function stop() {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
    document.getElementById("startBtn").disabled = false;
    log("Show gestoppt.");
  }

  return { start, stop };
})();
