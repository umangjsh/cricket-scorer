import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { oversDisplayFromBalls, teamLabel } from "../utils.js";

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listMatches()
      .then((m) => setMatches(m.slice().reverse()))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-inner">
      <section className="pitch-hero">
        <div className="hero-content">
          <h1>Every ball, live, for everyone watching from the boundary.</h1>
          <p>
            Free ball-by-ball scoring with a full scorecard, wagon wheel, Manhattan and worm
            graphs, and auto-generated match awards — built for local cricket, streamed to
            friends and family in real time.
          </p>
          <Link to="/setup" className="btn btn-primary">
            Start scoring a match
          </Link>
        </div>
      </section>

      <h2 style={{ fontFamily: "var(--font-display)" }}>Live &amp; recent matches</h2>
      {loading && <p className="muted">Loading matches…</p>}
      {!loading && matches.length === 0 && (
        <p className="muted">No matches yet — start the first one above.</p>
      )}
      <div className="grid-3">
        {matches.map((m) => (
          <Link to={`/match/${m.id}`} key={m.id} className="panel" style={{ textDecoration: "none" }}>
            <span className="tag">{m.status}</span>
            <h3 style={{ marginBottom: 4 }}>
              {teamLabel(m.teamA)} vs {teamLabel(m.teamB)}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {m.oversLimit}-over match
              {m.innings?.[0] &&
                ` · ${m.innings[0].totalRuns}/${m.innings[0].wickets} (${oversDisplayFromBalls(
                  m.innings[0].legalBalls
                )})`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
