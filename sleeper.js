// ============================================================
// SLEEPER API – alle Netzwerk-Calls an api.sleeper.app
// ============================================================

const Sleeper = (() => {
  const BASE = "https://api.sleeper.app/v1";
  const PLAYERS_CACHE_KEY = "fdc_players_cache_v1";
  const PLAYERS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 Tag

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sleeper request failed: ${url} (${res.status})`);
    return res.json();
  }

  async function getDraft(draftId) {
    return getJson(`${BASE}/draft/${draftId}`);
  }

  async function getPicks(draftId) {
    return getJson(`${BASE}/draft/${draftId}/picks`);
  }

  async function getLeagueRosters(leagueId) {
    if (!leagueId) return [];
    return getJson(`${BASE}/league/${leagueId}/rosters`);
  }

  async function getLeagueUsers(leagueId) {
    if (!leagueId) return [];
    return getJson(`${BASE}/league/${leagueId}/users`);
  }

  // Der vollständige Spieler-Datensatz ist mehrere MB groß und ändert sich
  // selten -> im localStorage cachen statt bei jedem Laden neu zu ziehen.
  async function getPlayers() {
    const cached = localStorage.getItem(PLAYERS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < PLAYERS_CACHE_MAX_AGE_MS) {
          return parsed.data;
        }
      } catch (e) {
        // Cache kaputt -> einfach neu laden
      }
    }
    const data = await getJson(`${BASE}/players/nfl`);
    localStorage.setItem(
      PLAYERS_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data })
    );
    return data;
  }

  // Baut roster_id -> Anzeigename (Team- oder Owner-Name)
  async function buildTeamNameMap(leagueId) {
    const map = {};
    if (!leagueId) return map;
    const [rosters, users] = await Promise.all([
      getLeagueRosters(leagueId),
      getLeagueUsers(leagueId)
    ]);
    const userById = {};
    users.forEach(u => (userById[u.user_id] = u));
    rosters.forEach(r => {
      const u = userById[r.owner_id];
      const name =
        (u && u.metadata && u.metadata.team_name) ||
        (u && u.display_name) ||
        `Team ${r.roster_id}`;
      map[r.roster_id] = name;
    });
    return map;
  }

  return { getDraft, getPicks, getLeagueRosters, getLeagueUsers, getPlayers, buildTeamNameMap };
})();
