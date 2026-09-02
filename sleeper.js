// ============================================================
// SLEEPER API – alle Netzwerk-Calls an api.sleeper.app
// ============================================================

const Sleeper = (() => {
  const BASE = "https://api.sleeper.app/v1";

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sleeper request failed: ${url} (${res.status})`);
    return res.json();
  }

  async function getDraft(draftId) {
    return getJson(`${BASE}/draft/${draftId}`);
  }

  // Jeder Pick enthält bereits metadata.first_name/last_name/position/team,
  // deshalb brauchen wir NICHT den riesigen /v1/players/nfl-Datensatz
  // (der ist ohnehin nicht für direkte Browser-Aufrufe per CORS freigegeben
  // und laut Sleeper nur für max. 1 Aufruf/Tag gedacht).
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

  // Baut eine Nachschlage-Map, die sowohl über roster_id als auch über
  // owner_id (User-ID) auflöst - Mock-Drafts liefern oft nur die User-ID
  // (picked_by) statt einer echten roster_id.
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
      if (r.owner_id) map[r.owner_id] = name; // Fallback-Schlüssel für Mock-Drafts
    });
    return map;
  }

  return { getDraft, getPicks, getLeagueRosters, getLeagueUsers, buildTeamNameMap };
})();
