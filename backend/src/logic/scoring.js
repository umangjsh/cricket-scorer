/**
 * Ball-by-ball scoring engine.
 *
 * Rules implemented follow the ICC Standard Playing Conditions
 * (https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)
 * for the parts relevant to live scoring:
 *  - legal balls vs extras (wide / no-ball don't count towards the over; bye / leg-bye do)
 *  - strike rotation on odd runs and at the end of every over
 *  - dismissal types and fall-of-wickets
 *  - innings ending on all-out (scaled to squad size) or overs completed
 *  - second-innings chase / target / result
 *
 * Not yet implemented (flagged here so it's easy to extend later):
 *  - Free-hit deliveries after a no-ball
 *  - Powerplay over restrictions
 *  - DLS (rain-adjusted targets)
 *  - Retired-hurt / substitute fielders
 */

const LEGAL_EXTRA_TYPES = new Set(["bye", "legbye"]);
const ILLEGAL_EXTRA_TYPES = new Set(["wide", "noball"]);

function blankBatsman(playerId) {
  return {
    playerId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    dismissal: null, // { type, bowlerId, fielderId }
  };
}

function blankBowler(playerId) {
  return {
    playerId,
    legalBalls: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
  };
}

export function createInnings({ battingTeamId, bowlingTeamId, target = null }) {
  return {
    battingTeamId,
    bowlingTeamId,
    target,
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0, // legal balls bowled this innings
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    batsmen: {}, // playerId -> stats
    bowlers: {}, // playerId -> stats
    onStrikeId: null,
    nonStrikeId: null,
    currentBowlerId: null,
    previousBowlerId: null,
    overs: [], // completed overs: [{ overNumber, bowlerId, balls: [ball,...], runsInOver }]
    currentOver: null, // { overNumber, bowlerId, balls: [] }
    fallOfWickets: [], // { score, wicket, over, playerId }
    ballLog: [], // flat history of every ball (for undo + wagon wheel + commentary)
    complete: false,
    result: null,
  };
}

function ensureBatsman(innings, playerId) {
  if (!innings.batsmen[playerId]) innings.batsmen[playerId] = blankBatsman(playerId);
  return innings.batsmen[playerId];
}

function ensureBowler(innings, playerId) {
  if (!innings.bowlers[playerId]) innings.bowlers[playerId] = blankBowler(playerId);
  return innings.bowlers[playerId];
}

function oversDisplay(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function currentRunRate(totalRuns, legalBalls) {
  if (legalBalls === 0) return 0;
  return Number(((totalRuns / legalBalls) * 6).toFixed(2));
}

function requiredRunRate(target, totalRuns, legalBalls, oversLimit) {
  if (target == null) return null;
  const ballsRemaining = oversLimit * 6 - legalBalls;
  const runsNeeded = target - totalRuns;
  if (ballsRemaining <= 0) return null;
  return Number(((runsNeeded / ballsRemaining) * 6).toFixed(2));
}

/** Swap who's on strike. */
function swapStrike(innings) {
  const tmp = innings.onStrikeId;
  innings.onStrikeId = innings.nonStrikeId;
  innings.nonStrikeId = tmp;
}

function buildCommentary(ball) {
  if (ball.isWicket) {
    const type = ball.wicketType || "out";
    return `WICKET! ${type.toUpperCase()}${ball.runs ? ` (${ball.runs} run(s) taken)` : ""}`;
  }
  if (ball.extraType === "wide") {
    const extra = ball.runs - 1;
    return extra > 0 ? `Wide + ${extra} extra run(s) (${ball.runs} total)` : "Wide";
  }
  if (ball.extraType === "noball") {
    const extra = ball.runs - 1;
    return extra > 0 ? `No ball + ${extra} run(s) off the bat (${ball.runs} total)` : "No ball";
  }
  if (ball.extraType === "bye") return `${ball.runs} bye(s)`;
  if (ball.extraType === "legbye") return `${ball.runs} leg bye(s)`;
  if (ball.runs === 4) return "FOUR!";
  if (ball.runs === 6) return "SIX!";
  if (ball.runs === 0) return "Dot ball";
  return `${ball.runs} run(s)`;
}

/**
 * Apply one delivery to the innings. Mutates and returns the innings.
 * ballInput:
 *  { bowlerId, batsmanId, runs, extraType, isWicket, wicketType, dismissedPlayerId, fielderId, shot }
 */
export function applyBall(innings, ballInput, { oversLimit, maxWickets = 10 }) {
  if (innings.complete) throw new Error("Innings already complete");

  const {
    bowlerId,
    batsmanId = innings.onStrikeId,
    runs = 0,
    extraType = null,
    isWicket = false,
    wicketType = null,
    dismissedPlayerId = null,
    fielderId = null,
    shot = null,
  } = ballInput;

  if (!bowlerId) throw new Error("bowlerId is required");
  if (!batsmanId) throw new Error("No batsman on strike");

  // Persist an incoming batsman supplied on this ball (e.g. right after a
  // wicket) onto strike, so subsequent balls no longer need it repeated.
  if (!innings.onStrikeId) innings.onStrikeId = batsmanId;

  const isLegalDelivery = !ILLEGAL_EXTRA_TYPES.has(extraType);
  const bowler = ensureBowler(innings, bowlerId);
  const striker = ensureBatsman(innings, batsmanId);

  innings.currentBowlerId = bowlerId;

  // Start a new over bucket if needed
  if (!innings.currentOver || innings.currentOver.bowlerId !== bowlerId && innings.currentOver.balls.length === 0) {
    innings.currentOver = {
      overNumber: innings.overs.length + 1,
      bowlerId,
      balls: [],
    };
  }

  // --- runs & extras bookkeeping ---
  let runsThisDelivery = runs;
  let batsmanCredit = runs;

  if (extraType === "wide") {
    innings.extras.wide += 1 + runs;
    runsThisDelivery = 1 + runs;
    batsmanCredit = 0;
  } else if (extraType === "noball") {
    innings.extras.noball += 1;
    runsThisDelivery = 1 + runs; // penalty + any runs off the bat
    batsmanCredit = runs; // runs off the bat on a no-ball DO count for the batsman
  } else if (extraType === "bye") {
    innings.extras.bye += runs;
    runsThisDelivery = runs;
    batsmanCredit = 0;
  } else if (extraType === "legbye") {
    innings.extras.legbye += runs;
    runsThisDelivery = runs;
    batsmanCredit = 0;
  }

  innings.totalRuns += runsThisDelivery;
  bowler.runsConceded += runsThisDelivery;

  if (batsmanCredit > 0) {
    striker.runs += batsmanCredit;
    if (batsmanCredit === 4) striker.fours += 1;
    if (batsmanCredit === 6) striker.sixes += 1;
  }
  // A batsman faces a ball on every legal delivery, and also on a no-ball
  // (but not on a wide, which isn't a delivery faced).
  if (extraType !== "wide") {
    striker.balls += 1;
  }

  // --- wicket ---
  if (isWicket) {
    innings.wickets += 1;
    bowler.wickets += ["runout", "retired"].includes(wicketType) ? 0 : 1;
    const dismissed = dismissedPlayerId || batsmanId;
    const dismissedStats = ensureBatsman(innings, dismissed);
    dismissedStats.out = true;
    dismissedStats.dismissal = { type: wicketType, bowlerId, fielderId };
    innings.fallOfWickets.push({
      score: innings.totalRuns,
      wicket: innings.wickets,
      over: oversDisplay(innings.legalBalls + (isLegalDelivery ? 1 : 0)),
      playerId: dismissed,
    });
  }

  // --- record the ball ---
  const ballRecord = {
    overNumber: innings.currentOver.overNumber,
    ballInOver: innings.currentOver.balls.length + 1,
    bowlerId,
    batsmanId,
    runs: runsThisDelivery,
    batsmanRuns: batsmanCredit,
    extraType,
    isLegal: isLegalDelivery,
    isWicket,
    wicketType,
    dismissedPlayerId: isWicket ? dismissedPlayerId || batsmanId : null,
    fielderId,
    shot,
    timestamp: Date.now(),
  };
  ballRecord.commentary = buildCommentary(ballRecord);
  innings.currentOver.balls.push(ballRecord);
  innings.ballLog.push(ballRecord);

  if (isLegalDelivery) {
    innings.legalBalls += 1;
    bowler.legalBalls += 1;
  }

  // --- strike rotation on odd runs (off the bat, or byes/leg-byes run out) ---
  const runsForRotation = extraType === "wide" ? runs : runsThisDelivery - (extraType === "noball" ? 1 : 0);
  if (runsForRotation % 2 === 1) swapStrike(innings);

  // If a wicket fell, the new batsman comes in on strike unless it was the
  // non-striker run out, in which case the striker stays on strike.
  if (isWicket) {
    const nonStrikerOut = dismissedPlayerId && dismissedPlayerId !== batsmanId;
    if (nonStrikerOut) {
      innings.nonStrikeId = null; // caller must supply the incoming batsman
    } else {
      innings.onStrikeId = null; // caller must supply the incoming batsman
    }
  }

  // --- end of over ---
  const overFinished = isLegalDelivery && innings.currentOver.balls.filter((b) => b.isLegal).length === 6;
  if (overFinished) {
    const runsInOver = innings.currentOver.balls.reduce((s, b) => s + b.runs, 0);
    innings.overs.push({ ...innings.currentOver, runsInOver, isMaiden: runsInOver === 0 });
    if (runsInOver === 0) bowler.maidens += 1;
    innings.previousBowlerId = bowlerId;
    innings.currentOver = null;
    if (!isWicket) swapStrike(innings); // ends of overs always rotate strike
  }

  // --- innings completion checks ---
  // "All out" scales to the batting side's actual squad size (maxWickets =
  // playingXI.length - 1: you need at least 2 batsmen to continue, so with
  // an N-player squad the innings ends once N-1 wickets have fallen) — NOT
  // a hard-coded 10, since this app supports any squad size, not just 11.
  const allOut = innings.wickets >= maxWickets;
  const oversUp = innings.legalBalls >= oversLimit * 6;
  const targetChased = innings.target != null && innings.totalRuns >= innings.target;
  if (allOut || oversUp || targetChased) {
    innings.complete = true;
  }

  return { innings, ball: ballRecord, overFinished, needsNewBatsman: isWicket && !innings.complete };
}

export function undoLastBall(innings) {
  const last = innings.ballLog.pop();
  if (!last) return innings;
  // Simplest correct approach for a prototype: this is intentionally not
  // implemented as a full inverse of applyBall (which would need to unwind
  // strike rotation, over-boundaries and wicket state precisely). Instead
  // the caller should rebuild the innings by replaying ballLog minus the
  // last entry through replayInnings(). See routes/api.js `undo` handler.
  return last;
}

/** Rebuild an innings from scratch by replaying a list of ball inputs. Used by undo. */
export function replayInnings(seedInnings, ballInputs, oversLimit, maxWickets = 10) {
  let innings = createInnings(seedInnings);
  innings.onStrikeId = seedInnings.onStrikeId;
  innings.nonStrikeId = seedInnings.nonStrikeId;
  for (const input of ballInputs) {
    applyBall(innings, input, { oversLimit, maxWickets });
  }
  return innings;
}

export function getScoreSummary(innings, oversLimit) {
  return {
    battingTeamId: innings.battingTeamId,
    bowlingTeamId: innings.bowlingTeamId,
    totalRuns: innings.totalRuns,
    wickets: innings.wickets,
    oversDisplay: oversDisplay(innings.legalBalls),
    legalBalls: innings.legalBalls,
    runRate: currentRunRate(innings.totalRuns, innings.legalBalls),
    requiredRunRate: requiredRunRate(innings.target, innings.totalRuns, innings.legalBalls, oversLimit),
    target: innings.target,
    extras: innings.extras,
    complete: innings.complete,
  };
}

export { oversDisplay, currentRunRate, requiredRunRate };
