export function oversDisplayFromBalls(legalBalls = 0) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function teamLabel(team) {
  if (!team) return "?";
  return team.name || team.teamId || "Team";
}

export function playerName(playingLists, playerId) {
  for (const list of playingLists) {
    const found = list.find((p) => p.id === playerId);
    if (found) return found.name;
  }
  return playerId || "—";
}

export function ballChipLabel(ball) {
  if (!ball) return "";
  if (ball.isWicket) return "W";
  // Wide/no-ball always carry a mandatory 1-run penalty; anything beyond
  // that is extra runs run/scored on the delivery, not more wides/no-balls —
  // so "3 extra runs on a wide" should read "3+1wd", never "4wd".
  if (ball.extraType === "wide") {
    const extra = ball.runs - 1;
    return extra > 0 ? `${extra}+1wd` : "wd";
  }
  if (ball.extraType === "noball") {
    const extra = ball.runs - 1;
    return extra > 0 ? `${extra}+1nb` : "nb";
  }
  if (ball.extraType === "bye") return `${ball.runs}b`;
  if (ball.extraType === "legbye") return `${ball.runs}lb`;
  return String(ball.runs);
}

export function battingRows(innings) {
  return Object.values(innings.batsmen).map((b) => ({
    ...b,
    strikeRate: b.balls === 0 ? 0 : Number(((b.runs / b.balls) * 100).toFixed(2)),
  }));
}

export function bowlingRows(innings) {
  return Object.values(innings.bowlers).map((b) => ({
    ...b,
    oversDisplay: `${Math.floor(b.legalBalls / 6)}.${b.legalBalls % 6}`,
    economy: b.legalBalls === 0 ? 0 : Number(((b.runsConceded / b.legalBalls) * 6).toFixed(2)),
  }));
}

export function ballChipClass(ball) {
  if (!ball) return "";
  if (ball.isWicket) return "wicket";
  if (ball.extraType) return "extra";
  if (ball.runs === 6) return "six";
  if (ball.runs === 4) return "boundary";
  return "";
}
