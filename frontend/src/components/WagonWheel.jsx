import { useRef } from "react";

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 10;

function polarToXY(angleDeg, distance) {
  // 0deg = straight up (towards the bowler's end sightscreen), clockwise.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * distance * RADIUS,
    y: CENTER + Math.sin(rad) * distance * RADIUS,
  };
}

function xyToPolar(x, y) {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / RADIUS);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (angle < 0) angle += 360;
  return { angle: Math.round(angle), distance: Number(distance.toFixed(2)) };
}

function dotColor(shot) {
  if (shot.runs === 6 || shot.isBoundary === true && shot.runs === 6) return "var(--leather)";
  if (shot.runs === 4) return "var(--gold)";
  if (shot.runs === 0) return "var(--ink-soft)";
  return "var(--pitch-light)";
}

/**
 * mode="input": click anywhere on the ground to pick a shot direction before
 * confirming a scoring button (used by the scorer).
 * mode="display": renders a set of already-recorded shots (used in analytics).
 */
export default function WagonWheel({ mode = "display", shots = [], pending = null, onPick }) {
  const svgRef = useRef(null);

  function handleClick(e) {
    if (mode !== "input" || !onPick) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    onPick(xyToPolar(x, y));
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ maxWidth: 300, display: "block", margin: "0 auto", cursor: mode === "input" ? "crosshair" : "default" }}
      onClick={handleClick}
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="var(--pitch)" stroke="var(--chalk)" strokeWidth="1.5" />
      <circle cx={CENTER} cy={CENTER} r={RADIUS * 0.62} fill="none" stroke="rgba(251,247,238,0.25)" strokeWidth="1" strokeDasharray="3 4" />
      {/* pitch strip */}
      <rect x={CENTER - 7} y={CENTER - 34} width="14" height="68" fill="var(--chalk)" opacity="0.85" />

      {shots.map((s, i) => {
        const { x, y } = polarToXY(s.angle, s.distance);
        return <circle key={i} cx={x} cy={y} r={s.runs >= 4 ? 4.5 : 3} fill={dotColor(s)} opacity="0.9" />;
      })}

      {pending && (
        <>
          {(() => {
            const { x, y } = polarToXY(pending.angle, pending.distance);
            return <circle cx={x} cy={y} r={6} fill="none" stroke="var(--gold)" strokeWidth="2" />;
          })()}
        </>
      )}
    </svg>
  );
}
