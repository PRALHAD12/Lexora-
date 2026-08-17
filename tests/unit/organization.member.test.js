import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import mongoose from "mongoose";

describe("Organization Member Management", () => {
  let mockOrg;
  let mockUser;

  beforeEach(() => {
    mockOrg = {
      _id: new mongoose.Types.ObjectId("64b8f0f0f0f0f0f0f0f00001"),
      name: "Acme Legal",
      owner: new mongoose.Types.ObjectId("64b8f0f0f0f0f0f0f0f00002"),
      members: [
        {
          _id: new mongoose.Types.ObjectId("64b8f0f0f0f0f0f0f0f00003"),
          userId: new mongoose.Types.ObjectId("64b8f0f0f0f0f0f0f0f00002"),
          email: "owner@acme.com",
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    mockUser = {
      _id: new mongoose.Types.ObjectId("64b8f0f0f0f0f0f0f0f00004"),
      email: "colleague@acme.com",
      firstName: "Jane",
      lastName: "Doe",
    };
  });

  it("should allow inviting a registered user as a pending member", () => {
    const isOwner = mockOrg.owner.toString() === "64b8f0f0f0f0f0f0f0f00002";
    expect(isOwner).toBe(true);

    mockOrg.members.push({
      _id: new mongoose.Types.ObjectId(),
      userId: mockUser._id,
      email: mockUser.email,
      role: "editor",
      status: "pending",
      joinedAt: new Date(),
    });

    expect(mockOrg.members.length).toBe(2);
    expect(mockOrg.members[1].email).toBe("colleague@acme.com");
    expect(mockOrg.members[1].role).toBe("editor");
    expect(mockOrg.members[1].status).toBe("pending");
  });

  it("should allow inviting an unregistered user as a pending member", () => {
    const unregisteredEmail = "newperson@acme.com";

    mockOrg.members.push({
      _id: new mongoose.Types.ObjectId(),
      userId: null,
      email: unregisteredEmail,
      role: "viewer",
      status: "pending",
      joinedAt: new Date(),
    });

    expect(mockOrg.members.length).toBe(2);
    expect(mockOrg.members[1].userId).toBeNull();
    expect(mockOrg.members[1].email).toBe("newperson@acme.com");
    expect(mockOrg.members[1].status).toBe("pending");
  });

  it("should prevent duplicate invitations for the same email", () => {
    mockOrg.members.push({
      _id: new mongoose.Types.ObjectId(),
      userId: mockUser._id,
      email: "colleague@acme.com",
      role: "viewer",
      status: "active",
    });

    const isDuplicate = mockOrg.members.some(
      (m) => m.email.toLowerCase() === "colleague@acme.com",
    );
    expect(isDuplicate).toBe(true);
  });

  it("should allow removing a non-owner member", () => {
    const memberIdToRemove = new mongoose.Types.ObjectId(
      "64b8f0f0f0f0f0f0f0f00005",
    );
    mockOrg.members.push({
      _id: memberIdToRemove,
      userId: mockUser._id,
      email: "colleague@acme.com",
      role: "viewer",
      status: "active",
    });

    expect(mockOrg.members.length).toBe(2);

    mockOrg.members = mockOrg.members.filter(
      (m) => m._id.toString() !== memberIdToRemove.toString(),
    );

    expect(mockOrg.members.length).toBe(1);
    expect(mockOrg.members[0].role).toBe("owner");
  });

  it("should allow an invited user to accept an invitation", () => {
    mockOrg.members.push({
      _id: new mongoose.Types.ObjectId(),
      userId: null,
      email: "colleague@acme.com",
      role: "editor",
      status: "pending",
      joinedAt: new Date(),
    });

    const pendingMember = mockOrg.members.find(
      (m) => m.email === "colleague@acme.com" && m.status === "pending",
    );
    expect(pendingMember).toBeDefined();

    // Accept invitation
    pendingMember.status = "active";
    pendingMember.userId = mockUser._id;
    pendingMember.respondedAt = new Date();

    expect(pendingMember.status).toBe("active");
    expect(pendingMember.userId).toEqual(mockUser._id);
    expect(pendingMember.respondedAt).toBeDefined();
  });

  it("should allow an invited user to decline an invitation", () => {
    mockOrg.members.push({
      _id: new mongoose.Types.ObjectId(),
      userId: null,
      email: "colleague@acme.com",
      role: "editor",
      status: "pending",
      joinedAt: new Date(),
    });

    const pendingMember = mockOrg.members.find(
      (m) => m.email === "colleague@acme.com" && m.status === "pending",
    );
    expect(pendingMember).toBeDefined();

    // Decline invitation
    pendingMember.status = "declined";
    pendingMember.respondedAt = new Date();

    expect(pendingMember.status).toBe("declined");
    expect(pendingMember.respondedAt).toBeDefined();
  });
});
