import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import { router } from "./routes/api.js";
import { registerSocketHandlers } from "./socket/index.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.get("/health", (_req, res) => res.json({ ok: true }));

// Express 4's async route handlers don't forward rejected promises to the
// error middleware on their own, and on modern Node an unhandled rejection
// terminates the whole process by default — meaning a single bad request
// could otherwise take the entire server down for every other match too.
// This middleware guarantees every route error becomes a normal JSON 500
// response instead, and the process stays up.
app.use((err, _req, res, _next) => {
  console.error("Unhandled route error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection (server stayed up):", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server stayed up):", err);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Cricket scorer backend listening on http://localhost:${PORT}`);
});

