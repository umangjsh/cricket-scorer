import { playerName } from "../utils.js";

export default function Scorecard({ battingScorecard, bowlingScorecard, playingLists, fallOfWickets }) {
  const name = (id) => playerName(playingLists, id);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
            <th>Dismissal</th>
          </tr>
        </thead>
        <tbody>
          {battingScorecard.map((b) => (
            <tr key={b.playerId}>
              <td className="name">{name(b.playerId)}</td>
              <td>{b.runs}</td>
              <td>{b.balls}</td>
              <td>{b.fours}</td>
              <td>{b.sixes}</td>
              <td>{b.strikeRate}</td>
              <td className="name">
                {b.out ? `${b.dismissal.type}${b.dismissal.bowlerId ? ` b ${name(b.dismissal.bowlerId)}` : ""}` : "not out"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>Bowling</h3>
      <table>
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowlingScorecard.map((b) => (
            <tr key={b.playerId}>
              <td className="name">{name(b.playerId)}</td>
              <td>{b.oversDisplay}</td>
              <td>{b.maidens}</td>
              <td>{b.runsConceded}</td>
              <td>{b.wickets}</td>
              <td>{b.economy}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {fallOfWickets?.length > 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          <strong style={{ color: "var(--ink)" }}>Fall of wickets: </strong>
          {fallOfWickets.map((f) => `${f.score}-${f.wicket} (${name(f.playerId)}, ${f.over} ov)`).join(", ")}
        </p>
      )}
    </div>
  );
}
