import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import config from "./index.js";

/**
 * AWS Cognito Identity Provider client (Admin SDK).
 * Used for server-side operations: sign-up, admin user management, etc.
 */
export const cognitoClient = new CognitoIdentityProviderClient({
  region: config.aws.region,
});

/**
 * Cognito JWT Verifier for Access tokens.
 * Automatically fetches and caches JWKS from the Cognito User Pool.
 */
export const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: config.aws.cognito.userPoolId,
  tokenUse: "access",
  clientId: config.aws.cognito.clientId,
});

/**
 * Cognito JWT Verifier for ID tokens.
 * Used when you need user attributes (email, name, etc.) from the token.
 */
export const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: config.aws.cognito.userPoolId,
  tokenUse: "id",
  clientId: config.aws.cognito.clientId,
});

export default {
  cognitoClient,
  accessTokenVerifier,
  idTokenVerifier,
};
