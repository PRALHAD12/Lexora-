import crypto from "crypto";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import { SimpleJsonFetcher } from "aws-jwt-verify/https";
import config from "./index.js";

/**
 * Custom JWKS Cache with extended response timeout (10s instead of default 1.5s).
 * Prevents intermittent timeouts during first-time key fetch on slower or remote networks.
 */
const customJwksCache = new SimpleJwksCache({
  fetcher: new SimpleJsonFetcher({
    defaultRequestOptions: {
      responseTimeout: 10000,
    },
  }),
});

/**
 * AWS Cognito Identity Provider client (Admin SDK).
 * Used for server-side operations: sign-up, admin user management, etc.
 */
export const cognitoClient = new CognitoIdentityProviderClient({
  region: config.aws.region,
});

/**
 * Calculates HMAC-SHA256 Secret Hash for Cognito API calls if client secret is configured.
 */
export function calculateSecretHash(username) {
  const secret = config.aws.cognito.clientSecret;
  if (!secret) {
    return undefined;
  }
  const clientId = config.aws.cognito.clientId;
  return crypto
    .createHmac("sha256", secret)
    .update(username + clientId)
    .digest("base64");
}

/**
 * Cognito JWT Verifier for Access tokens.
 * Automatically fetches and caches JWKS from the Cognito User Pool.
 */
export const accessTokenVerifier = CognitoJwtVerifier.create(
  {
    userPoolId: config.aws.cognito.userPoolId,
    tokenUse: "access",
    clientId: config.aws.cognito.clientId,
  },
  { jwksCache: customJwksCache },
);

/**
 * Cognito JWT Verifier for ID tokens.
 * Used when you need user attributes (email, name, etc.) from the token.
 */
export const idTokenVerifier = CognitoJwtVerifier.create(
  {
    userPoolId: config.aws.cognito.userPoolId,
    tokenUse: "id",
    clientId: config.aws.cognito.clientId,
  },
  { jwksCache: customJwksCache },
);

// Pre-hydrate JWKS on startup in non-test environments
if (
  typeof accessTokenVerifier.hydrate === "function" &&
  config.aws.cognito.userPoolId &&
  config.env !== "test"
) {
  accessTokenVerifier.hydrate().catch(() => {});
  if (typeof idTokenVerifier.hydrate === "function") {
    idTokenVerifier.hydrate().catch(() => {});
  }
}

export default {
  cognitoClient,
  calculateSecretHash,
  accessTokenVerifier,
  idTokenVerifier,
};
