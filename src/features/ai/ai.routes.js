import { Router } from "express";
import { generateAI } from "./ai.controller.js";

const router = Router();

// POST /api/v1/ai/generate
router.post("/generate", generateAI);

export default router;
