import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

function emptyPlayers(n) {
  return Array.from({ length: n }, () => "");
}

export default function MatchSetup() {
  const navigate = useNavigate();
  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [playersA, setPlayersA] = useState(emptyPlayers(6));
  const [playersB, setPlayersB] = useState(emptyPlayers(6));
  const [oversLimit, setOversLimit] = useState(20);
  const [tossWinner, setTossWinner] = useState("A");
  const [tossDecision, setTossDecision] = useState("bat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const updatePlayer = (list, setList, idx, value) => {
    const copy = [...list];
    copy[idx] = value;
    setList(copy);
  };

  const addRow = (list, setList) => setList([...list, ""]);
  const removeRow = (list, setList, idx) => setList(list.filter((_, i) => i !== idx));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleanA = playersA.map((p) => p.trim()).filter(Boolean);
    const cleanB = playersB.map((p) => p.trim()).filter(Boolean);
    if (!teamAName || !teamBName) return setError("Both team names are required.");
    if (cleanA.length < 2 || cleanB.length < 2) return setError("Add at least 2 players per team.");

    setBusy(true);
    try {
      const teamA = await api.createTeam(teamAName);
      const teamB = await api.createTeam(teamBName);

      const playersACreated = [];
      for (const name of cleanA) playersACreated.push(await api.createPlayer(name, teamA.id));
      const playersBCreated = [];
      for (const name of cleanB) playersBCreated.push(await api.createPlayer(name, teamB.id));

      const tossWinnerTeamId = tossWinner === "A" ? teamA.id : teamB.id;

      const match = await api.createMatch({
        teamA: { teamId: teamA.id, name: teamA.name, playingXI: playersACreated.map(({ id, name }) => ({ id, name })) },
        teamB: { teamId: teamB.id, name: teamB.name, playingXI: playersBCreated.map(({ id, name }) => ({ id, name })) },
        oversLimit: Number(oversLimit),
        tossWinnerTeamId,
        tossDecision,
      });

      navigate(`/match/${match.id}/score/${match.scorerToken}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-inner">
      <h1 style={{ fontFamily: "var(--font-display)" }}>Set up a new match</h1>
      <p className="muted">This creates both teams' squads and starts the toss. It only takes a minute.</p>

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="panel">
            <h3>Team A</h3>
            <div className="field">
              <label>Team name</label>
              <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} placeholder="e.g. Riverside CC" />
            </div>
            <label>Playing XI</label>
            {playersA.map((p, i) => (
              <div className="player-row" key={i}>
                <input
                  value={p}
                  onChange={(e) => updatePlayer(playersA, setPlayersA, i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  title="Remove player"
                  onClick={() => removeRow(playersA, setPlayersA, i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => addRow(playersA, setPlayersA)}>
              + add player
            </button>
          </div>

          <div className="panel">
            <h3>Team B</h3>
            <div className="field">
              <label>Team name</label>
              <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} placeholder="e.g. Northside XI" />
            </div>
            <label>Playing XI</label>
            {playersB.map((p, i) => (
              <div className="player-row" key={i}>
                <input
                  value={p}
                  onChange={(e) => updatePlayer(playersB, setPlayersB, i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  title="Remove player"
                  onClick={() => removeRow(playersB, setPlayersB, i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => addRow(playersB, setPlayersB)}>
              + add player
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Match conditions</h3>
          <div className="grid-3">
            <div className="field">
              <label>Overs per side</label>
              <input type="number" min="1" value={oversLimit} onChange={(e) => setOversLimit(e.target.value)} />
            </div>
            <div className="field">
              <label>Toss won by</label>
              <select value={tossWinner} onChange={(e) => setTossWinner(e.target.value)}>
                <option value="A">{teamAName || "Team A"}</option>
                <option value="B">{teamBName || "Team B"}</option>
              </select>
            </div>
            <div className="field">
              <label>Elected to</label>
              <select value={tossDecision} onChange={(e) => setTossDecision(e.target.value)}>
                <option value="bat">Bat first</option>
                <option value="bowl">Bowl first</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary" disabled={busy} style={{ marginTop: 8 }}>
          {busy ? "Creating match…" : "Create match & start scoring"}
        </button>
      </form>
    </div>
  );
}
