import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock AWS SDK before importing service
const mockSend = jest.fn();
jest.unstable_mockModule("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
  SignUpCommand: jest.fn((params) => ({ ...params, _type: "SignUp" })),
  ConfirmSignUpCommand: jest.fn((params) => ({
    ...params,
    _type: "ConfirmSignUp",
  })),
  InitiateAuthCommand: jest.fn((params) => ({
    ...params,
    _type: "InitiateAuth",
  })),
  ForgotPasswordCommand: jest.fn((params) => ({
    ...params,
    _type: "ForgotPassword",
  })),
  ConfirmForgotPasswordCommand: jest.fn((params) => ({
    ...params,
    _type: "ConfirmForgotPassword",
  })),
  GlobalSignOutCommand: jest.fn((params) => ({
    ...params,
    _type: "GlobalSignOut",
  })),
  ChangePasswordCommand: jest.fn((params) => ({
    ...params,
    _type: "ChangePassword",
  })),
  GetUserCommand: jest.fn((params) => ({ ...params, _type: "GetUser" })),
  ResendConfirmationCodeCommand: jest.fn((params) => ({
    ...params,
    _type: "ResendCode",
  })),
  AdminGetUserCommand: jest.fn((params) => ({
    ...params,
    _type: "AdminGetUser",
  })),
}));

// Mock User model
jest.unstable_mockModule("../../src/features/user/user.model.js", () => ({
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock config
jest.unstable_mockModule("../../src/config/aws.js", () => ({
  cognitoClient: { send: mockSend },
  accessTokenVerifier: { verify: jest.fn() },
  idTokenVerifier: { verify: jest.fn() },
}));

// Dynamic imports after mocks
const { default: AuthService } =
  await import("../../src/features/auth/auth.service.js");
const { default: User } = await import("../../src/features/user/user.model.js");

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signUp", () => {
    it("should register a new user successfully", async () => {
      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue({});

      mockSend.mockResolvedValue({
        UserSub: "test-sub-123",
        UserConfirmed: false,
      });

      const result = await AuthService.signUp({
        email: "test@example.com",
        password: "Test@1234",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.userSub).toBe("test-sub-123");
      expect(result.isConfirmed).toBe(false);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cognitoSub: "test-sub-123",
          email: "test@example.com",
        }),
      );
    });

    it("should throw conflict error if user already exists locally", async () => {
      User.findOne.mockResolvedValue({ email: "test@example.com" });

      await expect(
        AuthService.signUp({
          email: "test@example.com",
          password: "Test@1234",
          firstName: "John",
          lastName: "Doe",
        }),
      ).rejects.toThrow("A user with this email already exists");
    });
  });

  describe("confirmSignUp", () => {
    it("should verify email successfully", async () => {
      mockSend.mockResolvedValue({});
      User.findOneAndUpdate.mockResolvedValue({});

      const result = await AuthService.confirmSignUp({
        email: "test@example.com",
        code: "123456",
      });

      expect(result.message).toContain("Email verified");
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { email: "test@example.com" },
        { isEmailVerified: true },
      );
    });
  });

  describe("signIn", () => {
    it("should return tokens on successful login", async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: "access-token-123",
          IdToken: "id-token-123",
          RefreshToken: "refresh-token-123",
          ExpiresIn: 3600,
          TokenType: "Bearer",
        },
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "user-id",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          role: "user",
        }),
      });

      const result = await AuthService.signIn({
        email: "test@example.com",
        password: "Test@1234",
      });

      expect(result.accessToken).toBe("access-token-123");
      expect(result.idToken).toBe("id-token-123");
      expect(result.refreshToken).toBe("refresh-token-123");
      expect(result.user).toBeDefined();
    });

    it("should handle challenge responses (e.g. MFA)", async () => {
      mockSend.mockResolvedValue({
        ChallengeName: "SMS_MFA",
        Session: "session-123",
        ChallengeParameters: {},
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await AuthService.signIn({
        email: "test@example.com",
        password: "Test@1234",
      });

      expect(result.challengeName).toBe("SMS_MFA");
    });
  });

  describe("refreshToken", () => {
    it("should return new tokens", async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: "new-access-token",
          IdToken: "new-id-token",
          ExpiresIn: 3600,
          TokenType: "Bearer",
        },
      });

      const result = await AuthService.refreshToken({
        refreshToken: "refresh-token-123",
      });

      expect(result.accessToken).toBe("new-access-token");
    });
  });

  describe("forgotPassword", () => {
    it("should initiate password reset", async () => {
      mockSend.mockResolvedValue({});

      const result = await AuthService.forgotPassword({
        email: "test@example.com",
      });

      expect(result.message).toBeDefined();
    });
  });

  describe("globalSignOut", () => {
    it("should sign out user globally", async () => {
      mockSend.mockResolvedValue({});

      const result = await AuthService.globalSignOut({
        accessToken: "access-token-123",
      });

      expect(result.message).toContain("Signed out");
    });
  });
});
