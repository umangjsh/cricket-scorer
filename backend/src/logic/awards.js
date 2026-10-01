import { battingScorecard, bowlingScorecard } from "./analytics.js";

/**
 * Simple, transparent points model (tune freely — every weight lives here):
 *   Batting:  1 pt/run, +1 bonus per four, +2 bonus per six,
 *             +bonus for strike rate > 125 (limited-overs form of impact)
 *   Bowling:  20 pts/wicket, +10 per maiden,
 *             +bonus for economy < 6
 *   Fielding: 10 pts/catch or run-out or stumping (credited via fielderId)
 * Player of the Match / MVP = highest total across all three.
 * Best Batsman = highest batting points. Best Bowler = highest bowling points.
 *
 * Note: a true season-long MVP (as CricHeroes computes it) aggregates these
 * points across many matches — this function scores a single match, which
 * doubles as the single-match MVP and Player-of-the-Match figure.
 */
export function computeMatchAwards(match) {
  const points = {}; // playerId -> { batting, bowling, fielding, total, name }

  const addPoints = (playerId, key, value) => {
    if (!points[playerId]) points[playerId] = { batting: 0, bowling: 0, fielding: 0, total: 0 };
    points[playerId][key] += value;
    points[playerId].total += value;
  };

  for (const innings of match.innings) {
    for (const b of battingScorecard(innings)) {
      let pts = b.runs * 1 + b.fours * 1 + b.sixes * 2;
      if (b.strikeRate > 125 && b.balls >= 10) pts += 10;
      addPoints(b.playerId, "batting", pts);
    }
    for (const b of bowlingScorecard(innings)) {
      let pts = b.wickets * 20 + b.maidens * 10;
      if (b.economy > 0 && b.economy < 6 && b.legalBalls >= 12) pts += 10;
      addPoints(b.playerId, "bowling", pts);
    }
    for (const ball of innings.ballLog) {
      if (ball.isWicket && ball.fielderId && ["caught", "runout", "stumped"].includes(ball.wicketType)) {
        addPoints(ball.fielderId, "fielding", 10);
      }
    }
  }

  const ranked = Object.entries(points)
    .map(([playerId, p]) => ({ playerId, ...p }))
    .sort((a, b) => b.total - a.total);

  const bestBatsman = [...ranked].sort((a, b) => b.batting - a.batting)[0] || null;
  const bestBowler = [...ranked].sort((a, b) => b.bowling - a.bowling)[0] || null;
  const playerOfMatch = ranked[0] || null;

  return {
    playerOfMatch,
    bestBatsman: bestBatsman && bestBatsman.batting > 0 ? bestBatsman : null,
    bestBowler: bestBowler && bestBowler.bowling > 0 ? bestBowler : null,
    mvp: playerOfMatch,
    leaderboard: ranked,
  };
}
