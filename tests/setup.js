/**
 * Jest test setup.
 * Sets required environment variables before any tests run.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/lexora_test';
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPoolId';
process.env.COGNITO_APP_CLIENT_ID = 'test-client-id-123456';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
