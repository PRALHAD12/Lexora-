import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock the aws-jwt-verify module
const mockVerify = jest.fn();
jest.unstable_mockModule("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Mock User model
const mockFindOne = jest.fn();
jest.unstable_mockModule("../../src/features/user/user.model.js", () => ({
  default: {
    findOne: mockFindOne,
  },
}));

// Mock config
jest.unstable_mockModule("../../src/config/aws.js", () => ({
  cognitoClient: {},
  accessTokenVerifier: { verify: mockVerify },
  idTokenVerifier: { verify: jest.fn() },
}));

// Import after mocks
const { default: authenticate } =
  await import("../../src/middleware/authenticate.js");

describe("Authenticate Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      ip: "127.0.0.1",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("should return 401 if no Authorization header is present", async () => {
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      }),
    );
  });

  it("should return 401 if Authorization header is not Bearer format", async () => {
    req.headers.authorization = "Basic some-token";

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      }),
    );
  });

  it("should return 401 if token verification fails", async () => {
    req.headers.authorization = "Bearer invalid-token";
    mockVerify.mockRejectedValue(new Error("Token expired"));

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      }),
    );
  });

  it("should attach user to req and call next on valid token", async () => {
    req.headers.authorization = "Bearer valid-token";

    const tokenPayload = {
      sub: "user-sub-123",
      email: "test@example.com",
      "cognito:groups": ["user"],
      token_use: "access",
      scope: "openid profile",
    };

    mockVerify.mockResolvedValue(tokenPayload);
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "mongo-id-123",
        email: "test@example.com",
        role: "user",
        firstName: "John",
        lastName: "Doe",
        isActive: true,
      }),
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(); // called without error
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe("user-sub-123");
    expect(req.user.email).toBe("test@example.com");
    expect(req.user.role).toBe("user");
  });

  it("should return 403 if user account is deactivated", async () => {
    req.headers.authorization = "Bearer valid-token";

    mockVerify.mockResolvedValue({
      sub: "user-sub-123",
      email: "test@example.com",
      "cognito:groups": [],
      token_use: "access",
    });

    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "mongo-id-123",
        email: "test@example.com",
        role: "user",
        isActive: false,
      }),
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      }),
    );
  });
});
