import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { getSocket } from "../socket.js";
import ScoringPad from "../components/ScoringPad.jsx";
import WagonWheel from "../components/WagonWheel.jsx";
import { oversDisplayFromBalls, playerName, ballChipLabel, ballChipClass } from "../utils.js";

function OpenersForm({ battingXI, bowlingXI, onConfirm, title = "Open the innings" }) {
  const [striker, setStriker] = useState(battingXI[0]?.id || "");
  const [nonStriker, setNonStriker] = useState(battingXI[1]?.id || "");
  const [bowler, setBowler] = useState(bowlingXI[0]?.id || "");
  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="grid-3">
        <div className="field">
          <label>Striker</label>
          <select value={striker} onChange={(e) => setStriker(e.target.value)}>
            {battingXI.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Non-striker</label>
          <select value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
            {battingXI.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Opening bowler</label>
          <select value={bowler} onChange={(e) => setBowler(e.target.value)}>
            {bowlingXI.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={() => onConfirm({ striker, nonStriker, bowler })}>
        Start
      </button>
    </div>
  );
}

function NewBatsmanForm({ options, onConfirm }) {
  const [id, setId] = useState(options[0]?.id || "");
  return (
    <div className="panel">
      <h3>Next batsman</h3>
      <div className="field">
        <label>Incoming batsman</label>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={() => onConfirm(id)}>
        Confirm
      </button>
    </div>
  );
}

function BowlerForm({ options, onConfirm }) {
  const [id, setId] = useState(options[0]?.id || "");
  return (
    <div className="panel">
      <h3>Next over — select bowler</h3>
      <div className="field">
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={() => onConfirm(id)}>
        Confirm bowler
      </button>
    </div>
  );
}

export default function ScorerView() {
  const { id, scorerToken } = useParams();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [pendingShot, setPendingShot] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    api.getMatch(id).then(setMatch).catch((e) => setError(e.message));
    const socket = getSocket();
    socketRef.current = socket;
    socket.emit("join-match", { matchId: id, role: "scorer" });
    const handler = (payload) => setMatch(payload.match);
    socket.on("match-update", handler);
    return () => socket.off("match-update", handler);
  }, [id]);

  const teams = useMemo(() => {
    if (!match) return null;
    const isATeamA = match.teamA.teamId === match.innings[match.currentInningsIndex]?.battingTeamId;
    return {
      battingXI: isATeamA ? match.teamA.playingXI : match.teamB.playingXI,
      bowlingXI: isATeamA ? match.teamB.playingXI : match.teamA.playingXI,
    };
  }, [match]);

  if (error) return <div className="page-inner">Error: {error}</div>;
  if (!match) return <div className="page-inner">Loading…</div>;

  const innings = match.innings[match.currentInningsIndex];
  const inningsNotStarted = !innings.onStrikeId && !innings.nonStrikeId && innings.ballLog.length === 0;
  const needsStriker = !inningsNotStarted && !innings.onStrikeId && !innings.complete;
  const needsNonStriker = !inningsNotStarted && !needsStriker && !innings.nonStrikeId && !innings.complete;
  // A bowler is only "needed" between overs (after at least one ball has
  // been bowled), AND only until a genuinely new bowler has been picked —
  // once currentBowlerId differs from the bowler who just finished the
  // previous over, we're done waiting and should show the scoring pad,
  // even though currentOver stays null until the first ball is actually
  // bowled with that new bowler.
  const overJustEnded = !innings.currentOver && innings.ballLog.length > 0;
  const newBowlerStillPending = overJustEnded && innings.currentBowlerId === innings.previousBowlerId;
  const needsBowler = !inningsNotStarted && !needsStriker && !needsNonStriker && newBowlerStillPending && !innings.complete;
  const allPlayers = [...match.teamA.playingXI, ...match.teamB.playingXI];
  const outIds = new Set(Object.values(innings.batsmen).filter((b) => b.out).map((b) => b.playerId));
  const battedIds = new Set(Object.keys(innings.batsmen));

  function submitBall(ballInput) {
    socketRef.current.emit(
      "score-ball",
      { matchId: id, scorerToken, ball: ballInput },
      (ack) => ack?.error && setError(ack.error)
    );
  }

  function confirmOpeners({ striker, nonStriker, bowler }) {
    socketRef.current.emit(
      "open-next-innings",
      { matchId: id, scorerToken, strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler },
      (ack) => ack?.error && setError(ack.error)
    );
  }

  function confirmNewBatsman(playerId) {
    const position = !innings.onStrikeId ? "striker" : "nonstriker";
    socketRef.current.emit(
      "set-new-batsman",
      { matchId: id, scorerToken, playerId, position },
      (ack) => ack?.error && setError(ack.error)
    );
  }

  function confirmBowler(bowlerId) {
    socketRef.current.emit("change-bowler", { matchId: id, scorerToken, bowlerId }, (ack) => {
      if (ack?.error) setError(ack.error);
    });
  }

  function undo() {
    socketRef.current.emit("undo-ball", { matchId: id, scorerToken }, (ack) => ack?.error && setError(ack.error));
  }

  if (match.status === "completed") {
    return (
      <div className="page-inner">
        <div className="panel">
          <h2>Match complete</h2>
          <p>{match.result?.margin}</p>
          <Link className="btn btn-primary" to={`/match/${id}/analytics`}>
            View analytics &amp; awards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      {error && (
        <div className="panel" style={{ borderColor: "var(--leather)", marginBottom: 16 }}>
          <p className="error-text" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      <Scoreboard match={match} innings={innings} allPlayers={allPlayers} />

      <div className="copy-box" style={{ marginTop: 16 }}>
        Viewer link (share with friends & family): {window.location.origin}/match/{id}
      </div>

      {inningsNotStarted && (
        <OpenersForm
          battingXI={teams.battingXI}
          bowlingXI={teams.bowlingXI}
          onConfirm={confirmOpeners}
          title={match.currentInningsIndex === 0 ? "Open the innings" : "Start the run chase"}
        />
      )}

      {!inningsNotStarted && needsStriker && (
        <NewBatsmanForm
          options={teams.battingXI.filter((p) => !outIds.has(p.id) && p.id !== innings.nonStrikeId)}
          onConfirm={confirmNewBatsman}
        />
      )}
      {!inningsNotStarted && !needsStriker && needsNonStriker && (
        <NewBatsmanForm
          options={teams.battingXI.filter((p) => !outIds.has(p.id) && p.id !== innings.onStrikeId)}
          onConfirm={confirmNewBatsman}
        />
      )}
      {!inningsNotStarted && !needsStriker && !needsNonStriker && needsBowler && (
        <BowlerForm
          options={teams.bowlingXI.filter((p) => p.id !== innings.previousBowlerId)}
          onConfirm={confirmBowler}
        />
      )}

      {!inningsNotStarted && !needsStriker && !needsNonStriker && !needsBowler && !innings.complete && (
        <>
          <div className="panel">
            <h3 style={{ marginBottom: 6 }}>Wagon wheel</h3>
            <WagonWheel mode="input" pending={pendingShot} onPick={setPendingShot} />
            {pendingShot && (
              <p className="muted" style={{ textAlign: "center", fontSize: 12 }}>
                Shot logged — now tap the runs scored ({pendingShot.angle}°, {pendingShot.distance})
                <button className="btn btn-ghost" onClick={() => setPendingShot(null)}>
                  clear
                </button>
              </p>
            )}
            <ScoringPad
              onSubmitBall={submitBall}
              strikerId={innings.onStrikeId}
              nonStrikerId={innings.nonStrikeId}
              battingXI={teams.battingXI}
              bowlingXI={teams.bowlingXI}
              pendingShot={pendingShot}
              onClearShot={() => setPendingShot(null)}
            />
            <button className="pad-btn undo" style={{ marginTop: 12 }} onClick={undo}>
              ↩ Undo last ball
            </button>
          </div>

          <CommentaryFeed innings={innings} allPlayers={allPlayers} />
        </>
      )}

      {innings.complete && !needsBowler && match.status !== "completed" && (
        <div className="panel">
          <h3>Innings complete</h3>
          <p className="muted">Setting up the next innings…</p>
        </div>
      )}
    </div>
  );
}

function Scoreboard({ match, innings, allPlayers }) {
  const other = match.innings[0] === innings ? null : match.innings[0];
  const ballsRemaining = Math.max(0, match.oversLimit * 6 - innings.legalBalls);
  const runsNeeded = innings.target != null ? Math.max(0, innings.target - innings.totalRuns) : null;
  const requiredRunRate =
    innings.target != null && ballsRemaining > 0 ? Number(((runsNeeded / ballsRemaining) * 6).toFixed(2)) : null;

  return (
    <div className="scoreboard">
      <div>
        <div className="team-name">
          <span className="live-dot" /> Innings {match.currentInningsIndex + 1}
        </div>
        <div className="score-digits">
          {innings.totalRuns}
          <span className="wkts">/{innings.wickets}</span>
        </div>
        <div className="overs">
          ({oversDisplayFromBalls(innings.legalBalls)} / {match.oversLimit} ov)
        </div>
        {innings.onStrikeId && (
          <div className="overs" style={{ marginTop: 4 }}>
            {playerName([allPlayers], innings.onStrikeId)}* &amp; {playerName([allPlayers], innings.nonStrikeId)}
            {innings.currentBowlerId && <> · bowling: {playerName([allPlayers], innings.currentBowlerId)}</>}
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
          Run rate: <span className="rr-value">{innings.legalBalls ? ((innings.totalRuns / innings.legalBalls) * 6).toFixed(2) : "0.00"}</span>
        </div>
        {innings.target != null && (
          <>
            <div>Target: {innings.target}</div>
            <div>
              Need {runsNeeded} off {ballsRemaining} ball{ballsRemaining === 1 ? "" : "s"}
            </div>
            <div>
              Required rate: <span className="rr-value">{requiredRunRate ?? "—"}</span>
            </div>
          </>
        )}
        {other && (
          <div className="muted">
            1st innings: {other.totalRuns}/{other.wickets}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentaryFeed({ innings, allPlayers }) {
  const balls = innings.ballLog.slice(-25);
  return (
    <div className="panel">
      <h3>Commentary</h3>
      <div className="commentary-feed">
        {balls.map((b, i) => (
          <div className="commentary-item" key={i}>
            <span className="over-ball">
              {b.overNumber}.{b.ballInOver}
            </span>
            <span>
              {b.commentary} — {playerName([allPlayers], b.batsmanId)} to {playerName([allPlayers], b.bowlerId)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
