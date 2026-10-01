const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  createTeam: (name) => request("/teams", { method: "POST", body: JSON.stringify({ name }) }),
  listTeams: () => request("/teams"),
  createPlayer: (name, teamId) =>
    request("/players", { method: "POST", body: JSON.stringify({ name, teamId }) }),
  listPlayers: (teamId) => request(`/players${teamId ? `?teamId=${teamId}` : ""}`),
  createMatch: (payload) => request("/matches", { method: "POST", body: JSON.stringify(payload) }),
  listMatches: () => request("/matches"),
  getMatch: (id) => request(`/matches/${id}`),
  openInnings: (id, payload) =>
    request(`/matches/${id}/open-innings`, { method: "POST", body: JSON.stringify(payload) }),
  getAnalytics: (id) => request(`/matches/${id}/analytics`),
  getAwards: (id) => request(`/matches/${id}/awards`),
};
