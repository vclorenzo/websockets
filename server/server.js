import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket, request) => {
  const ip = request.socket.remoteAddress;
  socket.on("message", (rawData) => {
    const message = rawData.toString();
    console.log(`Broadcast: ${message}`);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Server: ${message}`);
      }
    });
  });

  socket.on("error", (err) => {
    console.error(`Error: ${err.message}: ${ip}`);
  });

  socket.on("close", () => {
    console.log("Client Disconnected");
  });
});
