import { Router } from "express";
import { getHealth, getCacheDebug } from "./health.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Server health check
 * @access  Public
 */
router.get("/", getHealth);

/**
 * @route   GET /api/v1/health/cache-debug
 * @desc    Inspect active Redis cache keys and contents
 * @access  Public
 */
router.get("/cache-debug", getCacheDebug);

export default router;
