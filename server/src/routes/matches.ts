import { Router } from "express";
import {
  createMatchController,
  listMatchesController,
  updateScoreController,
} from "../controllers/matches.js";

export const matchRouter = Router();

matchRouter.get("/", listMatchesController);
matchRouter.post("/", createMatchController);
matchRouter.patch("/:id/score", updateScoreController);
