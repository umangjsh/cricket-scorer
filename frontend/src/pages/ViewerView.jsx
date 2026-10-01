import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { getSocket } from "../socket.js";
import Scorecard from "../components/Scorecard.jsx";
import { oversDisplayFromBalls, playerName, ballChipLabel, ballChipClass, battingRows, bowlingRows } from "../utils.js";

export default function ViewerView() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMatch(id).then(setMatch).catch((e) => setError(e.message));
    const socket = getSocket();
    socket.emit("join-match", { matchId: id, role: "viewer" });
    const handler = (payload) => setMatch(payload.match);
    socket.on("match-update", handler);
    return () => socket.off("match-update", handler);
  }, [id]);

  if (error) return <div className="page-inner">Error: {error}</div>;
  if (!match) return <div className="page-inner">Loading…</div>;

  const innings = match.innings[match.currentInningsIndex];
  const other = match.innings[0] === innings ? null : match.innings[0];
  const playingLists = [match.teamA.playingXI, match.teamB.playingXI];
  const battingTeamName = match.teamA.teamId === innings.battingTeamId ? match.teamA.name : match.teamB.name;
  const bowlingTeamName = match.teamA.teamId === innings.bowlingTeamId ? match.teamA.name : match.teamB.name;

  return (
    <div className="page-inner">
      <p className="muted" style={{ marginBottom: 4 }}>
        {match.teamA.name} vs {match.teamB.name} · {match.oversLimit} overs
      </p>

      <div className="scoreboard">
        <div>
          <div className="team-name">
            {match.status === "live" && <span className="live-dot" />}
            {battingTeamName}
          </div>
          <div className="score-digits">
            {innings.totalRuns}
            <span className="wkts">/{innings.wickets}</span>
          </div>
          <div className="overs">
            ({oversDisplayFromBalls(innings.legalBalls)} / {match.oversLimit} ov) vs {bowlingTeamName}
          </div>
          {innings.onStrikeId && (
            <div className="over-strip" style={{ marginTop: 14 }}>
              <span className="tag" style={{ borderColor: "var(--line-on-dark)", color: "var(--chalk)" }}>
                {playerName(playingLists, innings.onStrikeId)}* &amp; {playerName(playingLists, innings.nonStrikeId)}
                {innings.currentBowlerId && <> · bowling: {playerName(playingLists, innings.currentBowlerId)}</>}
              </span>
            </div>
          )}
          <div className="over-strip">
            {(innings.currentOver?.balls || innings.overs.at(-1)?.balls || []).map((b, i) => (
              <div key={i} className={`ball-chip ${ballChipClass(b)}`}>
                {ballChipLabel(b)}
              </div>
            ))}
          </div>
        </div>
        <div className="meta">
          <div>
            Run rate:{" "}
            <span className="rr-value">
              {innings.legalBalls ? ((innings.totalRuns / innings.legalBalls) * 6).toFixed(2) : "0.00"}
            </span>
          </div>
          {innings.target != null && (
            <>
              <div>Target: {innings.target}</div>
              <div>
                Need {Math.max(0, innings.target - innings.totalRuns)} off{" "}
                {Math.max(0, match.oversLimit * 6 - innings.legalBalls)} balls
              </div>
              <div>
                Required rate:{" "}
                <span className="rr-value">
                  {(() => {
                    const ballsRemaining = Math.max(0, match.oversLimit * 6 - innings.legalBalls);
                    const runsNeeded = Math.max(0, innings.target - innings.totalRuns);
                    return ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "—";
                  })()}
                </span>
              </div>
            </>
          )}
          {other && (
            <div className="muted">
              1st innings: {other.totalRuns}/{other.wickets} ({oversDisplayFromBalls(other.legalBalls)})
            </div>
          )}
        </div>
      </div>

      {match.status === "completed" && (
        <div className="panel" style={{ marginTop: 20, textAlign: "center" }}>
          <h3 style={{ margin: 0 }}>{match.result?.margin}</h3>
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Live scorecard</h3>
        <Scorecard
          battingScorecard={battingRows(innings)}
          bowlingScorecard={bowlingRows(innings)}
          playingLists={playingLists}
          fallOfWickets={innings.fallOfWickets}
        />
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Commentary</h3>
        <div className="commentary-feed">
          {innings.ballLog
            .slice(-25)
            .map((b, i) => (
              <div className="commentary-item" key={i}>
                <span className="over-ball">
                  {b.overNumber}.{b.ballInOver}
                </span>
                <span>{b.commentary}</span>
              </div>
            ))}
        </div>
      </div>

      <Link className="btn btn-outline on-cream" to={`/match/${id}/analytics`} style={{ marginTop: 20, display: "inline-block" }}>
        View analytics &amp; awards →
      </Link>
    </div>
  );
}
