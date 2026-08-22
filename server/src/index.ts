import express from "express";
import http from "http";
import { Request, Response } from "express";
import { matchRouter } from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";

const portEnv = process.env.PORT;
const parsedPort =
  portEnv === undefined || portEnv === "" ? NaN : Number(portEnv);
const PORT =
  Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535
    ? parsedPort
    : 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

app.use("/matches", matchRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : PORT;
  const baseUrl =
    HOST === "0.0.0.0"
      ? `http://localhost:${port}`
      : `http://${HOST}:${port}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `Websocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
