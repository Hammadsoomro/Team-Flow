import { RequestHandler } from "express";
import { z } from "zod";
import { getCollections, getDB } from "../db";
import { ObjectId } from "mongodb";

export const getSorterSettings: RequestHandler = async (req, res) => {
  try {
    const teamId = (req as any).teamId;

    if (!teamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const db = getDB();
    const settingsCollection = db.collection("sorterSettings");

    let settings = await settingsCollection.findOne({
      teamId,
    });

    if (!settings) {
      // Return default settings if none exist
      settings = {
        teamId,
        linesClaim: 5,
        cooldownMinutes: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    res.json({
      linesClaim: settings.linesClaim || 5,
      cooldownMinutes: settings.cooldownMinutes || 5,
    });
  } catch (error) {
    console.error("Get sorter settings error:", error);
    res.status(400).json({ error: "Failed to fetch sorter settings" });
  }
};

export const updateSorterSettings: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      linesClaim: z.number().min(1).max(15).optional(),
      cooldownMinutes: z.number().min(1).optional(),
    });

    const validated = schema.parse(req.body);
    const userId = (req as any).userId;
    const teamId = (req as any).teamId;

    if (!userId || !teamId) {
      console.error("Missing userId or teamId:", { userId, teamId });
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Check if admin
    const collections = getCollections();
    const user = await collections.users.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      console.error("User not found:", userId);
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user?.role !== "admin") {
      res.status(403).json({ error: "Only admins can update sorter settings" });
      return;
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (validated.linesClaim !== undefined) {
      updateData.linesClaim = validated.linesClaim;
    }

    if (validated.cooldownMinutes !== undefined) {
      updateData.cooldownMinutes = validated.cooldownMinutes;
    }

    try {
      const db = getDB();
      const settingsCollection = db.collection("sorterSettings");

      const result = await settingsCollection.updateOne(
        { teamId },
        {
          $set: updateData,
          $setOnInsert: {
            teamId,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );

      console.log("Sorter settings updated:", result);

      res.json({
        success: true,
        message: "Sorter settings updated successfully",
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      res.status(500).json({ error: "Database error: " + String(dbError) });
    }
  } catch (error) {
    console.error("Update sorter settings error:", error);
    res.status(400).json({ error: "Invalid request: " + String(error) });
  }
};
