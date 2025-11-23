import { RequestHandler } from "express";
import { z } from "zod";
import { getCollections } from "../db";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// Helper: Hash password
const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

// Create team member - admin only
export const createTeamMember: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string(),
      name: z.string().min(2),
    });

    const validated = schema.parse(req.body);
    const adminId = (req as any).userId;
    const adminTeamId = (req as any).teamId;

    if (!adminId || !adminTeamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Check if admin
    const collections = getCollections();
    const admin = await collections.users.findOne({
      _id: new ObjectId(adminId),
    });

    if (admin?.role !== "admin") {
      res.status(403).json({ error: "Only admins can create team members" });
      return;
    }

    if (validated.password !== validated.confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    // Check if email already exists
    const existing = await collections.users.findOne({
      email: validated.email,
    });

    if (existing) {
      res.status(400).json({ error: "Email already exists" });
      return;
    }

    const hashedPassword = hashPassword(validated.password);

    const result = await collections.users.insertOne({
      email: validated.email,
      name: validated.name,
      password: hashedPassword,
      role: "member",
      teamId: adminTeamId,
      createdBy: adminId,
      profilePicture: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocked: false,
    });

    // Auto-add to admin's group chat
    const groupChat = await collections.chatGroups.findOne({
      teamId: adminTeamId,
      name: `${admin?.name}'s Team`,
    });

    if (groupChat) {
      if (!groupChat.members.includes(result.insertedId.toString())) {
        await collections.chatGroups.updateOne(
          { _id: groupChat._id },
          {
            $push: {
              members: result.insertedId.toString(),
            },
          },
        );
      }
    } else {
      await collections.chatGroups.insertOne({
        name: `${admin?.name}'s Team`,
        members: [adminId, result.insertedId.toString()],
        teamId: adminTeamId,
        createdAt: new Date().toISOString(),
      });
    }

    res.status(201).json({
      success: true,
      member: {
        _id: result.insertedId.toString(),
        email: validated.email,
        name: validated.name,
        role: "member",
        teamId: adminTeamId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create team member error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};

// Get team members - admin only
export const getTeamMembersAdmin: RequestHandler = async (req, res) => {
  try {
    const adminId = (req as any).userId;
    const teamId = (req as any).teamId;

    if (!adminId || !teamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const members = await collections.users
      .find({ teamId, _id: { $ne: new ObjectId(adminId) } })
      .toArray();

    const formattedMembers = members.map((m) => ({
      _id: m._id.toString(),
      email: m.email,
      name: m.name,
      role: m.role,
      blocked: m.blocked || false,
      createdAt: m.createdAt,
    }));

    res.json({ members: formattedMembers });
  } catch (error) {
    console.error("Get team members error:", error);
    res.status(400).json({ error: "Failed to fetch team members" });
  }
};

// Edit team member - admin only
export const editTeamMember: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      memberId: z.string(),
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
    });

    const validated = schema.parse(req.body);
    const adminTeamId = (req as any).teamId;

    if (!adminTeamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    // Verify member belongs to this team
    const member = await collections.users.findOne({
      _id: new ObjectId(validated.memberId),
      teamId: adminTeamId,
    });

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (validated.name) {
      updateData.name = validated.name;
    }

    if (validated.email) {
      const existing = await collections.users.findOne({
        email: validated.email,
        _id: { $ne: new ObjectId(validated.memberId) },
      });

      if (existing) {
        res.status(400).json({ error: "Email already exists" });
        return;
      }

      updateData.email = validated.email;
    }

    await collections.users.updateOne(
      { _id: new ObjectId(validated.memberId) },
      { $set: updateData },
    );

    res.json({ success: true, message: "Member updated successfully" });
  } catch (error) {
    console.error("Edit team member error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};

// Block/Unblock team member - admin only
export const toggleBlockTeamMember: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      memberId: z.string(),
      blocked: z.boolean(),
    });

    const validated = schema.parse(req.body);
    const adminTeamId = (req as any).teamId;

    if (!adminTeamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const member = await collections.users.findOne({
      _id: new ObjectId(validated.memberId),
      teamId: adminTeamId,
    });

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await collections.users.updateOne(
      { _id: new ObjectId(validated.memberId) },
      {
        $set: {
          blocked: validated.blocked,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    res.json({
      success: true,
      message: `Member ${validated.blocked ? "blocked" : "unblocked"}`,
    });
  } catch (error) {
    console.error("Toggle block member error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};

// Remove team member - admin only
export const removeTeamMember: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      memberId: z.string(),
    });

    const validated = schema.parse(req.body);
    const adminTeamId = (req as any).teamId;

    if (!adminTeamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const member = await collections.users.findOne({
      _id: new ObjectId(validated.memberId),
      teamId: adminTeamId,
    });

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await collections.users.deleteOne({
      _id: new ObjectId(validated.memberId),
    });

    res.json({ success: true, message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove team member error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};
