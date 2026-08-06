import winston from "winston";
import config from "../config/index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? `\n${JSON.stringify(meta, null, 2)}`
    : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

// Structured JSON format for production
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: config.log.level,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
  ),
  defaultMeta: { service: "lexora-backend" },
  transports: [
    // Console transport — always active
    new winston.transports.Console({
      format:
        config.app.env === "production"
          ? prodFormat
          : combine(colorize(), devFormat),
    }),

    // File transports — production only
    ...(config.app.env === "production"
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

export default logger;
