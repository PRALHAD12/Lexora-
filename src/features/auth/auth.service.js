import {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  GetUserCommand,
  ResendConfirmationCodeCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { cognitoClient, calculateSecretHash } from "../../config/aws.js";
import config from "../../config/index.js";
import User from "../user/user.model.js";
import ApiError from "../../utils/ApiError.js";
import { AUTH_FLOWS, ERROR_MESSAGES } from "../../utils/constants.js";
import logger from "../../utils/logger.js";

const { userPoolId, clientId } = config.aws.cognito;

/**
 * Auth Service — AWS Cognito integration layer.
 * All Cognito SDK interactions are encapsulated here.
 */
class AuthService {
  /**
   * Register a new user in Cognito and create a local DB profile.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.firstName
   * @param {string} params.lastName
   * @returns {object} { userSub, message }
   */
  async signUp({ email, password, firstName, lastName }) {
    // 1. Check if user already exists locally
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict(ERROR_MESSAGES.USER_EXISTS);
    }

    // 2. Register in Cognito
    const secretHash = calculateSecretHash(email);
    const command = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      ...(secretHash && { SecretHash: secretHash }),
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "given_name", Value: firstName },
        { Name: "family_name", Value: lastName },
      ],
    });

    const response = await cognitoClient.send(command);

    // 3. Create local user profile
    await User.create({
      cognitoSub: response.UserSub,
      email,
      firstName,
      lastName,
      isEmailVerified: false,
    });

    logger.info(`User registered: ${email} (sub: ${response.UserSub})`);

    return {
      userSub: response.UserSub,
      isConfirmed: response.UserConfirmed,
      message:
        "Registration successful. Please check your email for a verification code.",
    };
  }

  /**
   * Confirm a user's email address with the verification code sent by Cognito.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.code
   * @returns {object} { message }
   */
  async confirmSignUp({ email, code }) {
    const secretHash = calculateSecretHash(email);
    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);

    // Update local profile
    await User.findOneAndUpdate({ email }, { isEmailVerified: true });

    logger.info(`Email verified: ${email}`);

    return { message: "Email verified successfully. You can now sign in." };
  }

  /**
   * Authenticate a user with email and password.
   * Returns Cognito ID, Access, and Refresh tokens.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {object} { accessToken, idToken, refreshToken, expiresIn, user }
   */
  async signIn({ email, password }) {
    const secretHash = calculateSecretHash(email);
    const command = new InitiateAuthCommand({
      AuthFlow: AUTH_FLOWS.USER_PASSWORD,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        ...(secretHash && { SECRET_HASH: secretHash }),
      },
    });

    const response = await cognitoClient.send(command);
    const { AuthenticationResult } = response;

    if (!AuthenticationResult) {
      // This can happen if a challenge (MFA, new password required) is returned
      return {
        challengeName: response.ChallengeName,
        session: response.Session,
        challengeParameters: response.ChallengeParameters,
        message: "Additional authentication step required",
      };
    }

    // Fetch local user profile
    const localUser = await User.findOne({ email }).lean();

    logger.info(`User signed in: ${email}`);

    return {
      accessToken: AuthenticationResult.AccessToken,
      idToken: AuthenticationResult.IdToken,
      refreshToken: AuthenticationResult.RefreshToken,
      expiresIn: AuthenticationResult.ExpiresIn,
      tokenType: AuthenticationResult.TokenType,
      user: localUser
        ? {
            id: localUser._id,
            email: localUser.email,
            firstName: localUser.firstName,
            lastName: localUser.lastName,
            role: localUser.role,
          }
        : null,
    };
  }

  /**
   * Refresh an expired access token using a refresh token.
   *
   * @param {object} params
   * @param {string} params.refreshToken
   * @returns {object} { accessToken, idToken, expiresIn }
   */
  async refreshToken({ refreshToken }) {
    const command = new InitiateAuthCommand({
      AuthFlow: AUTH_FLOWS.REFRESH_TOKEN,
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);
    const { AuthenticationResult } = response;

    return {
      accessToken: AuthenticationResult.AccessToken,
      idToken: AuthenticationResult.IdToken,
      expiresIn: AuthenticationResult.ExpiresIn,
      tokenType: AuthenticationResult.TokenType,
    };
  }

  /**
   * Initiate a password reset flow. Cognito sends a code to the user's email.
   *
   * @param {object} params
   * @param {string} params.email
   * @returns {object} { message }
   */
  async forgotPassword({ email }) {
    const secretHash = calculateSecretHash(email);
    const command = new ForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);

    logger.info(`Password reset initiated: ${email}`);

    return {
      message:
        "If an account with that email exists, a password reset code has been sent.",
    };
  }

  /**
   * Confirm a password reset with the code and new password.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.code
   * @param {string} params.newPassword
   * @returns {object} { message }
   */
  async confirmForgotPassword({ email, code, newPassword }) {
    const secretHash = calculateSecretHash(email);
    const command = new ConfirmForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);

    logger.info(`Password reset confirmed: ${email}`);

    return {
      message:
        "Password has been reset successfully. You can now sign in with your new password.",
    };
  }

  /**
   * Change password for an authenticated user.
   *
   * @param {object} params
   * @param {string} params.accessToken - Current valid access token
   * @param {string} params.previousPassword
   * @param {string} params.proposedPassword
   * @returns {object} { message }
   */
  async changePassword({ accessToken, previousPassword, proposedPassword }) {
    const command = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword,
    });

    await cognitoClient.send(command);

    logger.info("Password changed successfully");

    return { message: "Password changed successfully." };
  }

  /**
   * Global sign out — invalidates all tokens for the user.
   *
   * @param {object} params
   * @param {string} params.accessToken
   * @returns {object} { message }
   */
  async globalSignOut({ accessToken }) {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    await cognitoClient.send(command);

    logger.info("User signed out globally");

    return { message: "Signed out successfully from all devices." };
  }

  /**
   * Get the current user's profile from Cognito + local DB.
   *
   * @param {object} params
   * @param {string} params.accessToken
   * @param {string} params.sub - Cognito user sub
   * @returns {object} User profile
   */
  async getProfile({ accessToken, sub }) {
    // Fetch Cognito attributes
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const cognitoUser = await cognitoClient.send(command);

    // Parse Cognito attributes into a flat object
    const attributes = {};
    for (const attr of cognitoUser.UserAttributes || []) {
      attributes[attr.Name] = attr.Value;
    }

    // Fetch local DB profile
    const localUser = await User.findOne({ cognitoSub: sub }).lean();

    return {
      sub: attributes.sub,
      email: attributes.email,
      emailVerified: attributes.email_verified === "true",
      firstName: attributes.given_name || localUser?.firstName,
      lastName: attributes.family_name || localUser?.lastName,
      role: localUser?.role || "user",
      avatar: localUser?.avatar,
      isActive: localUser?.isActive,
      createdAt: localUser?.createdAt,
      updatedAt: localUser?.updatedAt,
    };
  }

  /**
   * Resend the email verification code.
   *
   * @param {object} params
   * @param {string} params.email
   * @returns {object} { message }
   */
  async resendVerificationCode({ email }) {
    const secretHash = calculateSecretHash(email);
    const command = new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: email,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);

    logger.info(`Verification code resent: ${email}`);

    return { message: "Verification code has been resent to your email." };
  }

  /**
   * Admin: Get user info directly from Cognito (server-side, no access token needed).
   *
   * @param {string} email
   * @returns {object} Cognito user data
   */
  async adminGetUser(email) {
    const command = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    });

    return await cognitoClient.send(command);
  }
}

export default new AuthService();
