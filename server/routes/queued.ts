import { RequestHandler } from "express";
import { z } from "zod";
import type { QueuedLine } from "@shared/api";
import { getCollections } from "../db";
import { ObjectId } from "mongodb";

export const addToQueue: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      lines: z.array(z.string()).min(1),
    });

    const validated = schema.parse(req.body);
    const teamId = (req as any).teamId;
    const userId = (req as any).userId;

    if (!teamId || !userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const linesToInsert = validated.lines.map((content) => ({
      content,
      addedBy: userId,
      addedAt: new Date().toISOString(),
      teamId,
    }));

    const result = await collections.queuedLines.insertMany(linesToInsert);

    const addedLines: QueuedLine[] = linesToInsert.map((line, idx) => ({
      _id: result.insertedIds[idx].toString(),
      ...line,
    }));

    res.json({ success: true, lines: addedLines });
  } catch (error) {
    console.error("Add to queue error:", error);
    res.status(400).json({ error: "Invalid request" });
  }
};

export const getQueuedLines: RequestHandler = async (req, res) => {
  try {
    const teamId = (req as any).teamId;

    if (!teamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const lines = await collections.queuedLines
      .find({ teamId })
      .sort({ addedAt: -1 })
      .toArray();

    const formattedLines: QueuedLine[] = lines.map((line) => ({
      _id: line._id.toString(),
      content: line.content,
      addedBy: line.addedBy,
      addedAt: line.addedAt,
      teamId: line.teamId,
    }));

    res.json({ lines: formattedLines });
  } catch (error) {
    console.error("Get queued lines error:", error);
    res.status(400).json({ error: "Failed to fetch queued lines" });
  }
};

export const clearQueuedLine: RequestHandler = async (req, res) => {
  try {
    const { lineId } = req.params;
    const teamId = (req as any).teamId;

    if (!teamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    const result = await collections.queuedLines.deleteOne({
      _id: new ObjectId(lineId),
      teamId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Line not found or unauthorized" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Clear queued line error:", error);
    res.status(400).json({ error: "Failed to clear line" });
  }
};

// Claim lines - move from queued to history
export const claimLines: RequestHandler = async (req, res) => {
  try {
    const schema = z.object({
      lineCount: z.number().min(1).max(15),
    });

    const validated = schema.parse(req.body);
    const userId = (req as any).userId;
    const teamId = (req as any).teamId;

    if (!userId || !teamId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const collections = getCollections();

    // Get user info
    const user = await collections.users.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get the specified number of lines from queue
    const linesToClaim = await collections.queuedLines
      .find({ teamId })
      .limit(validated.lineCount)
      .toArray();

    if (linesToClaim.length === 0) {
      res.status(400).json({ error: "No lines available to claim" });
      return;
    }

    const claimedAt = new Date().toISOString();

    // Move lines to history
    const historyEntries = linesToClaim.map((line) => ({
      content: line.content,
      claimedBy: userId,
      claimedByName: user.name,
      claimedAt,
      teamId,
      originalAddedBy: line.addedBy,
      originalAddedAt: line.addedAt,
    }));

    await collections.history.insertMany(historyEntries);

    // Delete claimed lines from queue
    const lineIds = linesToClaim.map((line) => line._id);
    await collections.queuedLines.deleteMany({
      _id: { $in: lineIds },
    });

    res.json({
      success: true,
      claimedCount: linesToClaim.length,
      lines: historyEntries,
    });
  } catch (error) {
    console.error("Claim lines error:", error);
    res.status(400).json({ error: "Failed to claim lines" });
  }
};
