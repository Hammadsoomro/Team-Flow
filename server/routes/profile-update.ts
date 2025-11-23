import { RequestHandler } from "express";
import { z } from "zod";
import { getCollections } from "../db";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// Helper: Hash password
const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

export const updateProfile: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).optional(),
    });

    const validated = schema.parse(req.body);
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();
    const user = await collections.users.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Update name if provided
    if (validated.name) {
      updateData.name = validated.name;
    }

    // Update password if provided
    if (validated.currentPassword && validated.newPassword) {
      const hashedCurrent = hashPassword(validated.currentPassword);
      if (user.password !== hashedCurrent) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }

      updateData.password = hashPassword(validated.newPassword);
    }

    if (Object.keys(updateData).length === 1) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    await collections.users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData },
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};
