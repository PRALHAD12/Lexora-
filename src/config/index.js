import dotenv from "dotenv";

// Load .env file in non-production environments
dotenv.config();

/**
 * Centralized, validated configuration object.
 * All environment variables are read once here and exported as a structured object.
 */
const config = {
  app: {
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT, 10) || 5000,
    isProduction: process.env.NODE_ENV === "production",
    isTest: process.env.NODE_ENV === "test",
  },

  db: {
    uri:
      process.env.NODE_ENV === "test"
        ? process.env.MONGODB_URI_TEST ||
          "mongodb://localhost:27017/lexora_test"
        : process.env.MONGODB_URI || "mongodb://localhost:27017/lexora",
  },

  aws: {
    region: process.env.AWS_REGION || "us-east-1",
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_APP_CLIENT_ID,
      clientSecret: process.env.COGNITO_APP_CLIENT_SECRET || null,
    },
  },

  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:3000", "http://localhost:5173"],
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    auth: {
      windowMs:
        parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
      maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 20,
    },
  },

  log: {
    level: process.env.LOG_LEVEL || "debug",
  },
};

/**
 * Validate that critical config values are present.
 * Called at startup to fail fast if misconfigured.
 */
export function validateConfig() {
  const required = [
    ["aws.cognito.userPoolId", config.aws.cognito.userPoolId],
    ["aws.cognito.clientId", config.aws.cognito.clientId],
  ];

  const missing = required.filter(([, value]) => !value);

  if (missing.length > 0) {
    const names = missing.map(([name]) => name).join(", ");
    throw new Error(
      `Missing required configuration: ${names}. Check your .env file.`,
    );
  }
}

export default config;
