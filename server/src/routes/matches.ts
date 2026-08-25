import { Router } from "express";
import {
  createMatchController,
  listMatchesController,
  updateScoreController,
} from "../controllers/matches.js";
import { commentaryRouter } from "./commentary.js";

export const matchRouter = Router();

matchRouter.get("/", listMatchesController);
matchRouter.post("/", createMatchController);
matchRouter.patch("/:id/score", updateScoreController);
matchRouter.use("/:id/commentary", commentaryRouter);
