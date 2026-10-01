import { Router } from "express";
import { nanoid } from "nanoid";
import { getDB } from "../db.js";
import { createInnings, getScoreSummary } from "../logic/scoring.js";
import {
  manhattan,
  worm,
  runRateProgression,
  wagonWheel,
  partnerships,
  battingScorecard,
  bowlingScorecard,
} from "../logic/analytics.js";
import { computeMatchAwards } from "../logic/awards.js";

export const router = Router();

// Wrap every async handler so a thrown/rejected error becomes a normal
// next(err) call instead of an unhandled rejection — which, on modern
// Node, would otherwise crash the whole process (see server.js's error
// middleware for where next(err) ends up).
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- Teams ----------
router.post(
  "/teams",
  ah(async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const db = await getDB();
    const team = { id: nanoid(8), name, createdAt: Date.now() };
    db.data.teams.push(team);
    await db.write();
    res.status(201).json(team);
  })
);

router.get(
  "/teams",
  ah(async (_req, res) => {
    const db = await getDB();
    res.json(db.data.teams);
  })
);

// ---------- Players ----------
router.post(
  "/players",
  ah(async (req, res) => {
    const { name, teamId } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const db = await getDB();
    const player = { id: nanoid(8), name, teamId: teamId || null, createdAt: Date.now() };
    db.data.players.push(player);
    await db.write();
    res.status(201).json(player);
  })
);

router.get(
  "/players",
  ah(async (req, res) => {
    const db = await getDB();
    const { teamId } = req.query;
    const players = teamId ? db.data.players.filter((p) => p.teamId === teamId) : db.data.players;
    res.json(players);
  })
);

// ---------- Matches ----------
router.post(
  "/matches",
  ah(async (req, res) => {
    const {
      teamA, // { teamId, name, playingXI: [{id,name}] }
      teamB,
      oversLimit = 20,
      tossWinnerTeamId,
      tossDecision, // 'bat' | 'bowl'
    } = req.body;

    if (!teamA?.teamId || !teamB?.teamId || !tossWinnerTeamId || !tossDecision) {
      return res.status(400).json({ error: "teamA, teamB, tossWinnerTeamId and tossDecision are required" });
    }
    if (!["bat", "bowl"].includes(tossDecision)) {
      return res.status(400).json({ error: 'tossDecision must be "bat" or "bowl"' });
    }
    if (tossWinnerTeamId !== teamA.teamId && tossWinnerTeamId !== teamB.teamId) {
      return res.status(400).json({ error: "tossWinnerTeamId must match teamA.teamId or teamB.teamId" });
    }

    const battingFirstId =
      tossDecision === "bat" ? tossWinnerTeamId : tossWinnerTeamId === teamA.teamId ? teamB.teamId : teamA.teamId;
    const bowlingFirstId = battingFirstId === teamA.teamId ? teamB.teamId : teamA.teamId;

    const db = await getDB();
    const match = {
      id: nanoid(10),
      scorerToken: nanoid(24),
      createdAt: Date.now(),
      status: "setup", // setup -> live -> completed
      oversLimit: Number(oversLimit) || 20,
      teamA,
      teamB,
      tossWinnerTeamId,
      tossDecision,
      battingFirstId,
      bowlingFirstId,
      currentInningsIndex: 0,
      innings: [createInnings({ battingTeamId: battingFirstId, bowlingTeamId: bowlingFirstId, target: null })],
      result: null,
    };
    db.data.matches.push(match);
    await db.write();
    res.status(201).json(match);
  })
);

router.get(
  "/matches",
  ah(async (_req, res) => {
    const db = await getDB();
    // Don't leak scorer tokens in the list view
    res.json(db.data.matches.map(({ scorerToken, ...m }) => m));
  })
);

router.get(
  "/matches/:id",
  ah(async (req, res) => {
    const db = await getDB();
    const match = db.data.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: "match not found" });
    const { scorerToken, ...publicMatch } = match;
    res.json(publicMatch);
  })
);

// Set the opening batsmen + bowler for the current innings (required before first ball)
router.post(
  "/matches/:id/open-innings",
  ah(async (req, res) => {
    const { scorerToken, strikerId, nonStrikerId, bowlerId } = req.body;
    const db = await getDB();
    const match = db.data.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: "match not found" });
    if (match.scorerToken !== scorerToken) return res.status(403).json({ error: "invalid scorer token" });

    const innings = match.innings[match.currentInningsIndex];
    innings.onStrikeId = strikerId;
    innings.nonStrikeId = nonStrikerId;
    innings.currentBowlerId = bowlerId;
    match.status = "live";
    await db.write();
    res.json(match);
  })
);

router.get(
  "/matches/:id/analytics",
  ah(async (req, res) => {
    const db = await getDB();
    const match = db.data.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: "match not found" });

    const perInnings = match.innings.map((innings, idx) => ({
      inningsNumber: idx + 1,
      battingTeamId: innings.battingTeamId,
      summary: getScoreSummary(innings, match.oversLimit),
      manhattan: manhattan(innings),
      worm: worm(innings),
      runRateProgression: runRateProgression(innings),
      wagonWheel: wagonWheel(innings),
      partnerships: partnerships(innings),
      battingScorecard: battingScorecard(innings),
      bowlingScorecard: bowlingScorecard(innings),
      fallOfWickets: innings.fallOfWickets,
    }));

    res.json({ matchId: match.id, innings: perInnings });
  })
);

router.get(
  "/matches/:id/awards",
  ah(async (req, res) => {
    const db = await getDB();
    const match = db.data.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: "match not found" });
    res.json(computeMatchAwards(match));
  })
);
