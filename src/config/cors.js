import config from './index.js';

/**
 * CORS configuration with whitelisted origins from environment.
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (config.cors.origins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (!config.app.isProduction) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
  maxAge: 86400, // 24 hours
};

export default corsOptions;
