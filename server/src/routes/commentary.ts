import { Router } from "express";
import {
  createCommentaryController,
  listCommentaryController,
} from "../controllers/commentary.js";

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", listCommentaryController);
commentaryRouter.post("/", createCommentaryController);
