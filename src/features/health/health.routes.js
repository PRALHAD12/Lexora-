import { Router } from "express";
import { getHealth } from "./health.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Server health check
 * @access  Public
 */
router.get("/", getHealth);

export default router;
