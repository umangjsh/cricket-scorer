# Boundary — Live Cricket Scoring & Analytics

A free, real-time ball-by-ball cricket scoring app: a full scorecard, live
viewer sharing for friends & family, Manhattan / Worm / Run-Rate graphs, a
click-to-place Wagon Wheel, and auto-generated match awards (Player of the
Match, Best Batsman, Best Bowler, MVP).

This is the first slice of a CricHeroes-style product — **Live Scoring &
Match Analytics** only. Community features, tournaments, ground booking and
commerce are intentionally out of scope for now (see Roadmap).

Rules follow the [ICC Standard Playing Conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)
for the parts relevant to scoring (legal deliveries vs extras, dismissal
types, over/innings/match completion, run-chases).

---

## Architecture

```
cricket-scorer/
├── backend/     Node + Express (REST for setup) + Socket.IO (live scoring)
│                 lowdb (JSON file) for storage — swap for Postgres later
└── frontend/    React (Vite) — Scorer view, Viewer view, Analytics
```

**Why this split:** the scoring engine, data model and real-time transport
all live in the backend, completely UI-agnostic. The web frontend is one
client of that backend. When you're ready for Android, you write a second
client (React Native, or native Kotlin) that talks to the **same** REST API
and the **same** Socket.IO events — no backend changes required.

### Data model (per match)
```
Match
├── teamA / teamB          { teamId, name, playingXI: [{id, name}] }
├── oversLimit, toss, scorerToken (secret — only the scorer's device has it)
├── currentInningsIndex
└── innings: [Innings, Innings?]
      ├── totalRuns, wickets, legalBalls, extras
      ├── batsmen{} / bowlers{}      per-player live stats
      ├── overs[] / currentOver      completed + in-progress over
      ├── ballLog[]                  full delivery-by-delivery history
      ├── fallOfWickets[]
      └── onStrikeId / nonStrikeId / currentBowlerId
```

### Real-time flow
1. The scorer's device holds the match's `scorerToken` (in the URL —
   `/match/:id/score/:scorerToken`) and is the only client allowed to emit
   scoring events.
2. Every `score-ball` (and `undo-ball`, `set-new-batsman`, `open-next-innings`,
   `change-bowler`) is validated against that token, applied to the innings
   on the server, and the resulting match state is broadcast to everyone in
   that match's Socket.IO room — including any number of viewers.
3. Viewers only ever read; they open `/match/:id` (no token) and get pushed
   live updates.

### Socket.IO events (client → server)
| Event | Payload | Notes |
|---|---|---|
| `join-match` | `{ matchId, role }` | `role`: `"scorer"` or `"viewer"` |
| `score-ball` | `{ matchId, scorerToken, ball }` | see `ball` shape below |
| `set-new-batsman` | `{ matchId, scorerToken, playerId, position }` | `position`: `"striker"` \| `"nonstriker"` |
| `change-bowler` | `{ matchId, scorerToken, bowlerId }` | rejects the same bowler as the previous over |
| `undo-ball` | `{ matchId, scorerToken }` | pops a full pre-ball snapshot |
| `open-next-innings` | `{ matchId, scorerToken, strikerId, nonStrikerId, bowlerId }` | used both to open innings 1 and to start the chase |

`ball` shape: `{ bowlerId?, batsmanId?, runs, extraType?, isWicket?, wicketType?, dismissedPlayerId?, fielderId?, shot? }`
— `extraType` is one of `wide | noball | bye | legbye`; `shot` is
`{ angle, distance }` from the Wagon Wheel (both 0–1 normalised, angle in
degrees) and is optional per ball.

Server → client: `match-update` `{ match, lastBall, needsNewBatsman, event }`
(`event` is `null | "innings-break" | "match-complete" | "undo"`).

### REST endpoints (setup only — not used for live scoring)
`POST /api/teams`, `POST /api/players`, `POST /api/matches`,
`GET /api/matches`, `GET /api/matches/:id`,
`GET /api/matches/:id/analytics`, `GET /api/matches/:id/awards`.

### Scoring engine rules implemented
- Legal balls vs extras: wides and no-balls don't count toward the over;
  byes and leg-byes do.
- Strike rotates on odd runs and at the end of every over.
- All common dismissal types (bowled, caught, lbw, run out, stumped, hit
  wicket), with fielder credit for awards.
- Innings ends on 10 wickets, overs completed, or (2nd innings) target
  chased.
- 2nd-innings target = 1st-innings total + 1; result computed from the
  final scores (runs / wickets margin, or tie).
- Full ball-log powers Manhattan, Worm, Run-Rate progression, Wagon Wheel,
  partnerships and both scorecards.

**Not yet implemented** (flagged in `backend/src/logic/scoring.js` too):
free hits after a no-ball, powerplay over restrictions, DLS, retired-hurt.

### Awards engine
A transparent points model (fully editable in `backend/src/logic/awards.js`):
runs + boundary bonuses + strike-rate bonus for batting; wickets + maidens +
economy bonus for bowling; a flat credit for catches/run-outs/stumpings.
Player of the Match / MVP = highest total; Best Batsman / Best Bowler =
highest in that category alone. A season-long MVP (aggregated across many
matches, the way CricHeroes does it) is a straightforward extension: sum
this same per-match points object across a player's matches.

---

## Running it locally

Requires Node 18+.

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev        # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open `http://localhost:5173`, click **Start scoring a match**, fill in both
squads, run the toss, and you'll land on the **Scorer** screen — it shows a
**viewer link** you can open in another tab (or send to anyone) to watch the
match update live. The scorer link (with the secret token) is the one to
keep private to whoever is scoring.

### Deploying
- **Backend**: any Node host (Railway, Render, Fly.io, a VPS). Swap
  `backend/src/db.js` for a real database when you need multiple server
  instances — right now lowdb writes to a single JSON file, which is fine
  for one server process.
- **Frontend**: any static host (Vercel, Netlify, Cloudflare Pages). Set
  `VITE_SOCKET_URL` to your deployed backend's URL at build time.

---

## Roadmap

**Toward the Android app**
The backend doesn't change. Two realistic paths:
1. **React Native** — reuse almost all of `frontend/src/api.js`,
   `socket.js`, and the component logic; rebuild the views with RN
   primitives.
2. **Native Kotlin** — call the same REST endpoints and connect with a
   Socket.IO Android client; port the view logic, keep the backend as-is.

**Toward full CricHeroes parity** (in the order CricHeroes' own value chain
suggests — nail scoring, then grow the network around it):
- Community: player/team profiles, "Find Cricketers", scorer/umpire
  registration
- Tournaments: brackets, points table, auto-schedule, NRR calculator
- Video live-streaming of matches (explicitly deferred for this phase)
- Ground booking, Store/Market, content feed
- Season-long MVP and leaderboards (points model already supports it)
- Free-hit / powerplay / DLS rules, scorer authentication beyond a bearer
  token (real accounts), a proper database in place of the JSON file
