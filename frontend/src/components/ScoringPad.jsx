import { useState } from "react";

const WICKET_TYPES = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "runout", label: "Run out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitwicket", label: "Hit wicket" },
];

const NEEDS_FIELDER = new Set(["caught", "runout", "stumped"]);

export default function ScoringPad({
  onSubmitBall,
  strikerId,
  nonStrikerId,
  battingXI, // [{id,name}]
  bowlingXI, // [{id,name}]
  pendingShot,
  onClearShot,
  disabled,
}) {
  const [mode, setMode] = useState(null); // null | 'wide' | 'noball' | 'bye' | 'legbye' | 'wicket'
  const [extraRuns, setExtraRuns] = useState(0);
  const [wicketType, setWicketType] = useState("bowled");
  const [dismissedId, setDismissedId] = useState(strikerId);
  const [fielderId, setFielderId] = useState("");

  function submit(ballInput) {
    onSubmitBall({ ...ballInput, shot: pendingShot || null });
    onClearShot?.();
    setMode(null);
    setExtraRuns(0);
    setWicketType("bowled");
    setDismissedId(strikerId);
    setFielderId("");
  }

  function scoreRuns(runs) {
    submit({ runs });
  }

  function confirmExtra() {
    if (mode === "wide") submit({ extraType: "wide", runs: extraRuns });
    if (mode === "noball") submit({ extraType: "noball", runs: extraRuns });
    if (mode === "bye") submit({ extraType: "bye", runs: extraRuns || 1 });
    if (mode === "legbye") submit({ extraType: "legbye", runs: extraRuns || 1 });
  }

  function confirmWicket() {
    submit({
      runs: extraRuns,
      isWicket: true,
      wicketType,
      dismissedPlayerId: dismissedId,
      fielderId: NEEDS_FIELDER.has(wicketType) && fielderId ? fielderId : null,
    });
  }

  if (mode === "wicket") {
    return (
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Record wicket</h3>
        <div className="field">
          <label>How out</label>
          <select
            value={wicketType}
            onChange={(e) => {
              const newType = e.target.value;
              setWicketType(newType);
              if (newType !== "runout") setExtraRuns(0);
            }}
          >
            {WICKET_TYPES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Batsman dismissed</label>
          <select value={dismissedId} onChange={(e) => setDismissedId(e.target.value)}>
            {[strikerId, nonStrikerId].map((id) => {
              const p = battingXI.find((b) => b.id === id);
              return (
                <option key={id} value={id}>
                  {p?.name || id} {id === strikerId ? "(striker)" : "(non-striker)"}
                </option>
              );
            })}
          </select>
        </div>
        {NEEDS_FIELDER.has(wicketType) && wicketType !== "runout" && (
          <div className="field">
            <label>Fielder (optional, for awards credit)</label>
            <select value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">—</option>
              {bowlingXI.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {wicketType === "runout" && (
          <>
            <div className="field">
              <label>Fielder (optional, for awards credit)</label>
              <select value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
                <option value="">—</option>
                {bowlingXI.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Runs completed before the run-out</label>
              <input type="number" min="0" value={extraRuns} onChange={(e) => setExtraRuns(Number(e.target.value))} />
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-danger" onClick={confirmWicket}>
            Confirm wicket
          </button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode) {
    const labels = { wide: "Wide", noball: "No ball", bye: "Byes", legbye: "Leg byes" };
    return (
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>{labels[mode]}</h3>
        <div className="field">
          <label>{mode === "wide" || mode === "noball" ? "Additional runs run" : "Runs"}</label>
          <input type="number" min="0" value={extraRuns} onChange={(e) => setExtraRuns(Number(e.target.value))} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={confirmExtra}>
            Confirm
          </button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
        Tip: tap a spot on the wagon wheel above first to log shot direction, then tap the runs scored.
      </p>
      <div className="scoring-pad">
        {[0, 1, 2, 3].map((r) => (
          <button key={r} className="pad-btn" disabled={disabled} onClick={() => scoreRuns(r)}>
            {r}
          </button>
        ))}
        <button className="pad-btn run-4" disabled={disabled} onClick={() => scoreRuns(4)}>
          4
        </button>
        <button className="pad-btn run-6" disabled={disabled} onClick={() => scoreRuns(6)}>
          6
        </button>
        <button className="pad-btn extra" disabled={disabled} onClick={() => setMode("wide")}>
          Wide
        </button>
        <button className="pad-btn extra" disabled={disabled} onClick={() => setMode("noball")}>
          No ball
        </button>
        <button className="pad-btn extra" disabled={disabled} onClick={() => setMode("bye")}>
          Bye
        </button>
        <button className="pad-btn extra" disabled={disabled} onClick={() => setMode("legbye")}>
          Leg bye
        </button>
        <button className="pad-btn wicket" disabled={disabled} onClick={() => setMode("wicket")}>
          Wicket
        </button>
      </div>
    </div>
  );
}
