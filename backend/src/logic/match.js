import { createInnings } from "./scoring.js";

/**
 * Call after every ball. Handles moving from innings 1 -> 2 (setting the
 * chase target) and, once the match is decided, computing the result.
 * Returns { event: null | "innings-break" | "match-complete" }.
 */
export function advanceMatchState(match) {
  const innings = match.innings[match.currentInningsIndex];
  if (!innings.complete) return { event: null };

  const isFirstInnings = match.currentInningsIndex === 0;

  if (isFirstInnings) {
    const target = innings.totalRuns + 1;
    const second = createInnings({
      battingTeamId: innings.bowlingTeamId,
      bowlingTeamId: innings.battingTeamId,
      target,
    });
    match.innings.push(second);
    match.currentInningsIndex = 1;
    return { event: "innings-break" };
  }

  // Second innings just finished -> compute the result.
  const first = match.innings[0];
  const second = match.innings[1];
  match.status = "completed";

  // "Wickets in hand" scales to the chasing side's actual squad size, not a
  // hard-coded 10 — same fix as the all-out threshold in scoring.js.
  const chasingTeam = match.teamA.teamId === second.battingTeamId ? match.teamA : match.teamB;
  const maxWickets = chasingTeam.playingXI.length - 1;

  if (second.totalRuns > first.totalRuns) {
    const wicketsInHand = maxWickets - second.wickets;
    match.result = {
      winnerTeamId: second.battingTeamId,
      margin: `won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`,
    };
  } else if (second.totalRuns < first.totalRuns) {
    match.result = {
      winnerTeamId: first.battingTeamId,
      margin: `won by ${first.totalRuns - second.totalRuns} run${first.totalRuns - second.totalRuns === 1 ? "" : "s"}`,
    };
  } else {
    match.result = { winnerTeamId: null, margin: "Match tied" };
  }

  return { event: "match-complete" };
}
