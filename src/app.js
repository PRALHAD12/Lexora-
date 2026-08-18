import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import corsOptions from "./config/cors.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import errorHandler from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import ApiError from "./utils/ApiError.js";

// Feature routes
import healthRoutes from "./features/health/health.routes.js";
import authRoutes from "./features/auth/auth.routes.js";
import userRoutes from "./features/user/user.routes.js";
import contractsRoutes from "./features/contracts/contracts.routes.js";
import organizationRoutes from "./features/organization/organization.routes.js";
import aiRoutes from "./features/ai/ai.routes.js";

const app = express();

// ─── Security Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));

// ─── Body Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ─── HTTP Request Logging ─────────────────────────────────────────
const morganFormat = app.get("env") === "production" ? "combined" : "dev";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

// ─── Rate Limiting ────────────────────────────────────────────────
app.use(generalLimiter);

// ─── API Routes ───────────────────────────────────────────────────
const API_PREFIX = "/api/v1";

app.use(`${API_PREFIX}/health`, healthRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/contracts`, contractsRoutes);
app.use(`${API_PREFIX}/organizations`, organizationRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);

// ─── Root Route ───────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Lexora API v1",
    docs: `${API_PREFIX}/health`,
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────
app.all("*", (req, _res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

export default app;
