import { getDB } from "../db.js";
import { applyBall } from "../logic/scoring.js";
import { advanceMatchState } from "../logic/match.js";

function roomFor(matchId) {
  return `match:${matchId}`;
}

function publicMatch(match) {
  const { scorerToken, undoStack, ...rest } = match;
  return rest;
}

function battingTeamXISize(match, innings) {
  const team = match.teamA.teamId === innings.battingTeamId ? match.teamA : match.teamB;
  return team.playingXI.length;
}

function snapshotMatch(match) {
  return JSON.parse(
    JSON.stringify({
      innings: match.innings,
      currentInningsIndex: match.currentInningsIndex,
      status: match.status,
      result: match.result,
    })
  );
}

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("join-match", ({ matchId, role }) => {
      socket.join(roomFor(matchId));
      socket.data.role = role;
      socket.data.matchId = matchId;
    });

    socket.on("score-ball", async ({ matchId, scorerToken, ball }, ack) => {
      try {
        const db = await getDB();
        const match = db.data.matches.find((m) => m.id === matchId);
        if (!match) return ack?.({ error: "match not found" });
        if (match.scorerToken !== scorerToken) return ack?.({ error: "invalid scorer token" });

        const innings = match.innings[match.currentInningsIndex];
        if (innings.complete) return ack?.({ error: "current innings is already complete" });
        if (!innings.onStrikeId && !ball.batsmanId) {
          return ack?.({ error: "a new batsman must be selected before the next ball" });
        }

        match.undoStack = match.undoStack || [];
        match.undoStack.push(snapshotMatch(match));

        // auto-fill an incoming batsman onto strike if one was supplied
        if (!innings.onStrikeId && ball.batsmanId) innings.onStrikeId = ball.batsmanId;

        const result = applyBall(innings, { ...ball, bowlerId: ball.bowlerId || innings.currentBowlerId }, {
          oversLimit: match.oversLimit,
          maxWickets: battingTeamXISize(match, innings) - 1,
        });
        const stateEvent = advanceMatchState(match);

        await db.write();

        io.to(roomFor(matchId)).emit("match-update", {
          match: publicMatch(match),
          lastBall: result.ball,
          needsNewBatsman: result.needsNewBatsman,
          event: stateEvent.event,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // For a non-striker run-out (rare) or to pre-assign the incoming batsman
    // explicitly rather than waiting for the next ball's batsmanId.
    socket.on("set-new-batsman", async ({ matchId, scorerToken, playerId, position }, ack) => {
      try {
        const db = await getDB();
        const match = db.data.matches.find((m) => m.id === matchId);
        if (!match) return ack?.({ error: "match not found" });
        if (match.scorerToken !== scorerToken) return ack?.({ error: "invalid scorer token" });
        const innings = match.innings[match.currentInningsIndex];
        if (position === "nonstriker") innings.nonStrikeId = playerId;
        else innings.onStrikeId = playerId;
        if (match.status === "setup") match.status = "live";
        await db.write();
        io.to(roomFor(matchId)).emit("match-update", { match: publicMatch(match), lastBall: null, event: null });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on("change-bowler", async ({ matchId, scorerToken, bowlerId }, ack) => {
      try {
        const db = await getDB();
        const match = db.data.matches.find((m) => m.id === matchId);
        if (!match) return ack?.({ error: "match not found" });
        if (match.scorerToken !== scorerToken) return ack?.({ error: "invalid scorer token" });
        const innings = match.innings[match.currentInningsIndex];
        if (innings.previousBowlerId === bowlerId) {
          return ack?.({ error: "the same bowler cannot bowl consecutive overs" });
        }
        innings.currentBowlerId = bowlerId;
        await db.write();
        io.to(roomFor(matchId)).emit("match-update", { match: publicMatch(match), lastBall: null, event: null });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on("undo-ball", async ({ matchId, scorerToken }, ack) => {
      try {
        const db = await getDB();
        const match = db.data.matches.find((m) => m.id === matchId);
        if (!match) return ack?.({ error: "match not found" });
        if (match.scorerToken !== scorerToken) return ack?.({ error: "invalid scorer token" });
        const snap = (match.undoStack || []).pop();
        if (!snap) return ack?.({ error: "nothing to undo" });
        match.innings = snap.innings;
        match.currentInningsIndex = snap.currentInningsIndex;
        match.status = snap.status;
        match.result = snap.result;
        await db.write();
        io.to(roomFor(matchId)).emit("match-update", { match: publicMatch(match), lastBall: null, event: "undo" });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on("open-next-innings", async ({ matchId, scorerToken, strikerId, nonStrikerId, bowlerId }, ack) => {
      try {
        const db = await getDB();
        const match = db.data.matches.find((m) => m.id === matchId);
        if (!match) return ack?.({ error: "match not found" });
        if (match.scorerToken !== scorerToken) return ack?.({ error: "invalid scorer token" });
        const innings = match.innings[match.currentInningsIndex];
        innings.onStrikeId = strikerId;
        innings.nonStrikeId = nonStrikerId;
        innings.currentBowlerId = bowlerId;
        if (match.status === "setup") match.status = "live";
        await db.write();
        io.to(roomFor(matchId)).emit("match-update", { match: publicMatch(match), lastBall: null, event: null });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });
  });
}
