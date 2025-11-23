import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { getCollections } from "../db";
import { ObjectId } from "mongodb";

// Upload profile picture
export const uploadProfilePicture: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { profilePictureUrl } = req.body;
    const userId = (req as any).userId;

    console.log(
      "Upload request received. userId:",
      userId,
      "has body:",
      !!req.body,
    );

    if (!userId) {
      console.error("No userId in request");
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!profilePictureUrl) {
      console.error("No profilePictureUrl in body");
      return res.status(400).json({ error: "Profile picture URL is required" });
    }

    const collections = getCollections();

    console.log("Attempting to update profile for user:", userId);

    const result = await collections.users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePictureUrl,
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: "after" },
    );

    if (!result.value) {
      console.error("User not found for ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("Profile picture updated successfully for user:", userId);

    const updatedUser = {
      _id: result.value._id.toString(),
      email: result.value.email,
      name: result.value.name,
      role: result.value.role,
      profilePictureUrl: result.value.profilePictureUrl,
      teamId: result.value.teamId,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt,
    };

    return res.json(updatedUser);
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    return res
      .status(500)
      .json({ error: `Failed to upload profile picture: ${String(error)}` });
  }
};

// Get profile
export const getProfile: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const collections = getCollections();
    const user = await collections.users.findOne({
      _id: new ObjectId(req.userId),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userProfile = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      profilePictureUrl: user.profilePictureUrl,
      teamId: user.teamId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json(userProfile);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
};
