import { jest, describe, it, expect } from "@jest/globals";
import request from "supertest";

// Mock AWS services before importing app
const mockSend = jest.fn();
const mockVerify = jest.fn();

jest.unstable_mockModule("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
  SignUpCommand: jest.fn((p) => p),
  ConfirmSignUpCommand: jest.fn((p) => p),
  InitiateAuthCommand: jest.fn((p) => p),
  ForgotPasswordCommand: jest.fn((p) => p),
  ConfirmForgotPasswordCommand: jest.fn((p) => p),
  GlobalSignOutCommand: jest.fn((p) => p),
  ChangePasswordCommand: jest.fn((p) => p),
  GetUserCommand: jest.fn((p) => p),
  ResendConfirmationCodeCommand: jest.fn((p) => p),
  AdminGetUserCommand: jest.fn((p) => p),
}));

jest.unstable_mockModule("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Mock mongoose to avoid needing a real DB
jest.unstable_mockModule("mongoose", () => {
  const mockSchema = jest.fn().mockImplementation(() => ({
    virtual: jest.fn().mockReturnValue({ get: jest.fn() }),
    index: jest.fn(),
    statics: {},
    pre: jest.fn(),
  }));
  mockSchema.Types = { ObjectId: String };

  const mockModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  return {
    default: {
      Schema: mockSchema,
      model: jest.fn(() => mockModel),
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      connection: {
        readyState: 1,
        host: "localhost",
        on: jest.fn(),
      },
    },
    Schema: mockSchema,
    model: jest.fn(() => mockModel),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connection: {
      readyState: 1,
      host: "localhost",
      on: jest.fn(),
    },
  };
});

const { default: app } = await import("../../src/app.js");

describe("Auth Routes — Integration Tests", () => {
  describe("POST /api/v1/auth/register", () => {
    it("should return 400 if email is missing", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        password: "Test@1234",
        firstName: "John",
        lastName: "Doe",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 if password is too weak", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        password: "123",
        firstName: "John",
        lastName: "Doe",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 if firstName is missing", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        password: "Test@1234",
        lastName: "Doe",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should return 400 if email is invalid", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "not-an-email",
        password: "Test@1234",
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 if password is missing", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "test@example.com",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/verify-email", () => {
    it("should return 400 if code is not 6 digits", async () => {
      const res = await request(app).post("/api/v1/auth/verify-email").send({
        email: "test@example.com",
        code: "12",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return 401 if no token is provided", async () => {
      const res = await request(app).get("/api/v1/auth/me");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should return 401 if no token is provided", async () => {
      const res = await request(app).post("/api/v1/auth/logout");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/health", () => {
    it("should return 200 and health data", async () => {
      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("healthy");
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/api/v1/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
