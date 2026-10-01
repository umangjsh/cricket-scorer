import { io } from "socket.io-client";

// In dev, Vite proxies /api to the backend but sockets need the full origin.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true, transports: ["websocket", "polling"] });
  }
  return socket;
}
