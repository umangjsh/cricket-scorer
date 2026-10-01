/**
 * Derives the classic scoring graphics from an innings' recorded ball log.
 * All functions are pure and read-only — safe to call on live, in-progress
 * innings as well as completed ones.
 */

/** Manhattan: runs scored in each completed (+ current partial) over. */
export function manhattan(innings) {
  const bars = innings.overs.map((o) => ({
    over: o.overNumber,
    runs: o.runsInOver,
    wickets: o.balls.filter((b) => b.isWicket).length,
  }));
  if (innings.currentOver && innings.currentOver.balls.length > 0) {
    bars.push({
      over: innings.currentOver.overNumber,
      runs: innings.currentOver.balls.reduce((s, b) => s + b.runs, 0),
      wickets: innings.currentOver.balls.filter((b) => b.isWicket).length,
      partial: true,
    });
  }
  return bars;
}

/** Worm: cumulative score after each over, for one or two innings overlaid. */
export function worm(innings) {
  let cumulative = 0;
  const points = [{ over: 0, runs: 0 }];
  for (const o of innings.overs) {
    cumulative += o.runsInOver;
    points.push({ over: o.overNumber, runs: cumulative });
  }
  if (innings.currentOver && innings.currentOver.balls.length > 0) {
    const partial = innings.currentOver.balls.reduce((s, b) => s + b.runs, 0);
    points.push({ over: innings.currentOver.overNumber, runs: cumulative + partial, partial: true });
  }
  return points;
}

/** Run-rate progression, over by over. */
export function runRateProgression(innings) {
  let cumulative = 0;
  let balls = 0;
  return innings.overs.map((o) => {
    cumulative += o.runsInOver;
    balls += o.balls.filter((b) => b.isLegal).length;
    return {
      over: o.overNumber,
      runRate: balls === 0 ? 0 : Number(((cumulative / balls) * 6).toFixed(2)),
    };
  });
}

/**
 * Wagon wheel: every recorded shot with a direction, as an angle (0-360,
 * 0 = straight down the ground past the bowler) and a distance (0-1,
 * normalised to boundary rope). Grouped per batsman.
 */
export function wagonWheel(innings, batsmanId) {
  return innings.ballLog
    .filter((b) => b.shot && (!batsmanId || b.batsmanId === batsmanId))
    .map((b) => ({
      batsmanId: b.batsmanId,
      runs: b.batsmanRuns,
      angle: b.shot.angle,
      distance: b.shot.distance,
      isBoundary: b.batsmanRuns === 4 || b.batsmanRuns === 6,
    }));
}

/** Batting partnerships in order, using fall-of-wicket boundaries. */
export function partnerships(innings) {
  const wicketBalls = innings.ballLog.filter((b) => b.isWicket);
  const result = [];
  let startScore = 0;
  let startBallIndex = 0;
  let wicketNo = 0;
  const pairFor = (uptoIndex) => {
    // batsmen involved in the balls between startBallIndex and uptoIndex
    const ids = new Set();
    innings.ballLog.slice(startBallIndex, uptoIndex + 1).forEach((b) => ids.add(b.batsmanId));
    return [...ids];
  };
  wicketBalls.forEach((wb, idx) => {
    const ballIndex = innings.ballLog.indexOf(wb);
    const runs = innings.fallOfWickets[idx] ? innings.fallOfWickets[idx].score - startScore : 0;
    result.push({
      wicketNo: wicketNo + 1,
      batsmen: pairFor(ballIndex),
      runs,
    });
    startScore = innings.fallOfWickets[idx] ? innings.fallOfWickets[idx].score : startScore;
    startBallIndex = ballIndex + 1;
    wicketNo += 1;
  });
  // Ongoing (unbroken) partnership
  if (startBallIndex < innings.ballLog.length) {
    result.push({
      wicketNo: wicketNo + 1,
      batsmen: pairFor(innings.ballLog.length - 1),
      runs: innings.totalRuns - startScore,
      unbroken: true,
    });
  }
  return result;
}

export function battingScorecard(innings) {
  return Object.values(innings.batsmen).map((b) => ({
    ...b,
    strikeRate: b.balls === 0 ? 0 : Number(((b.runs / b.balls) * 100).toFixed(2)),
  }));
}

export function bowlingScorecard(innings) {
  return Object.values(innings.bowlers).map((b) => ({
    ...b,
    oversDisplay: `${Math.floor(b.legalBalls / 6)}.${b.legalBalls % 6}`,
    economy: b.legalBalls === 0 ? 0 : Number(((b.runsConceded / b.legalBalls) * 6).toFixed(2)),
  }));
}
