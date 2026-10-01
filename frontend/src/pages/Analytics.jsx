import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import Manhattan from "../components/Manhattan.jsx";
import Worm from "../components/Worm.jsx";
import WagonWheel from "../components/WagonWheel.jsx";
import Scorecard from "../components/Scorecard.jsx";
import { playerName } from "../utils.js";

export default function Analytics() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [awards, setAwards] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getMatch(id), api.getAnalytics(id), api.getAwards(id)])
      .then(([m, a, aw]) => {
        setMatch(m);
        setAnalytics(a);
        setAwards(aw);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="page-inner">Error: {error}</div>;
  if (!match || !analytics) return <div className="page-inner">Loading…</div>;

  const playingLists = [match.teamA.playingXI, match.teamB.playingXI];
  const teamName = (teamId) => (match.teamA.teamId === teamId ? match.teamA.name : match.teamB.name);
  const name = (pid) => playerName(playingLists, pid);

  const current = analytics.innings[tab];
  const wormSeries = analytics.innings.map((inn) => ({
    label: teamName(inn.battingTeamId),
    points: inn.worm,
  }));

  return (
    <div className="page-inner wide">
      <p className="muted">
        {match.teamA.name} vs {match.teamB.name} · {match.oversLimit} overs ·{" "}
        {match.status === "completed" ? match.result?.margin : "in progress"}
      </p>

      {awards && (awards.playerOfMatch || awards.bestBatsman || awards.bestBowler) && (
        <>
          <h2 style={{ fontFamily: "var(--font-display)" }}>
            {match.status === "completed" ? "Match awards" : "Current form leaders"}
          </h2>
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {awards.playerOfMatch && (
              <div className="award-card">
                <div className="label">Player of the Match</div>
                <div className="name">{name(awards.playerOfMatch.playerId)}</div>
                <div className="points">{awards.playerOfMatch.total} pts</div>
              </div>
            )}
            {awards.bestBatsman && (
              <div className="award-card">
                <div className="label">Best Batsman</div>
                <div className="name">{name(awards.bestBatsman.playerId)}</div>
                <div className="points">{awards.bestBatsman.batting} pts</div>
              </div>
            )}
            {awards.bestBowler && (
              <div className="award-card">
                <div className="label">Best Bowler</div>
                <div className="name">{name(awards.bestBowler.playerId)}</div>
                <div className="points">{awards.bestBowler.bowling} pts</div>
              </div>
            )}
          </div>
        </>
      )}

      <h2 style={{ fontFamily: "var(--font-display)" }}>Worm — cumulative runs</h2>
      <div className="panel">
        <Worm innings={wormSeries} />
      </div>

      <div className="tabs" style={{ marginTop: 32 }}>
        {analytics.innings.map((inn, i) => (
          <button key={i} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>
            Innings {i + 1} — {teamName(inn.battingTeamId)}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Manhattan — runs per over</h3>
          <Manhattan data={current.manhattan} />
        </div>
        <div className="panel">
          <h3>Wagon wheel</h3>
          <WagonWheel mode="display" shots={current.wagonWheel} />
        </div>
      </div>

      <div className="panel">
        <h3>Scorecard</h3>
        <Scorecard
          battingScorecard={current.battingScorecard}
          bowlingScorecard={current.bowlingScorecard}
          playingLists={playingLists}
          fallOfWickets={current.fallOfWickets}
        />
      </div>

      {current.partnerships?.length > 0 && (
        <div className="panel">
          <h3>Partnerships</h3>
          <table>
            <thead>
              <tr>
                <th>Wkt</th>
                <th>Batsmen</th>
                <th>Runs</th>
              </tr>
            </thead>
            <tbody>
              {current.partnerships.map((p, i) => (
                <tr key={i}>
                  <td>{p.wicketNo}</td>
                  <td className="name">{p.batsmen.map(name).join(" & ")}</td>
                  <td>{p.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link to={`/match/${id}`} className="btn btn-outline on-cream" style={{ marginTop: 20, display: "inline-block" }}>
        ← Back to live scorecard
      </Link>
    </div>
  );
}
