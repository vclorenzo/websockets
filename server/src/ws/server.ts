import type { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import type { matches } from "../db/schema.js";

type Match = typeof matches.$inferSelect;

/**
 * Sends a JSON-encoded payload through an open WebSocket connection.
 *
 * @param socket - The WebSocket connection that receives the payload
 * @param payload - The value to encode and send
 */
function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

/**
 * Sends a payload to every connected WebSocket client.
 *
 * @param wss - The WebSocket server whose clients receive the payload
 * @param payload - The value to serialize and send
 */
function broadcast(wss: WebSocketServer, payload: unknown): void {
  for (const client of wss.clients) {
    sendJson(client, payload);
  }
}

/**
 * Attaches a WebSocket server to the HTTP server and provides match-created event broadcasting.
 *
 * @param server - The HTTP server that hosts the WebSocket endpoint
 * @returns An object containing a function for broadcasting match-created events
 */
export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket: WebSocket) => {
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
