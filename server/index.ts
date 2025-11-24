import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleSignup } from "./routes/auth";
import {
  addToQueue,
  getQueuedLines,
  clearQueuedLine,
  clearAllQueuedLines,
  claimLines,
} from "./routes/queued";
import { addToHistory, getHistory, searchHistory } from "./routes/history";
import {
  getOrCreateGroupChat,
  sendMessage,
  getMessages,
  addMemberToGroup,
  setTyping,
  getTypingStatus,
  markMessageAsRead,
  editMessage,
  deleteMessage,
} from "./routes/chat";
import { createTeamMember, getTeamMembers } from "./routes/members";
import { updateProfile } from "./routes/profile-update";
import {
  createTeamMember as createTeamMemberAdmin,
  getTeamMembersAdmin,
  editTeamMember,
  toggleBlockTeamMember,
  removeTeamMember,
} from "./routes/team-management";
import {
  getSorterSettings,
  updateSorterSettings,
} from "./routes/sorter-settings";
import { uploadProfilePicture, getProfile } from "./routes/profile";
import { connectDB } from "./db";
import { authMiddleware } from "./middleware/auth";
import { getCollections } from "./db";
import { Server } from "socket.io";
import http from "http";
import { verifyToken } from "./routes/auth";

export let io: Server;
let httpServer: http.Server;
let socketIOInitialized = false;

export function getIO() {
  return io;
}

export function getHttpServer() {
  return httpServer;
}

export async function createServer() {
  // Initialize MongoDB connection
  try {
    await connectDB();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }

  const app = express();

  // Only create httpServer once (avoid recreating on HMR in dev mode)
  if (!httpServer) {
    httpServer = http.createServer(app);
  } else {
    // Update the request listener on the existing httpServer
    httpServer.removeAllListeners("request");
    httpServer.on("request", app);
  }

  if (!io) {
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
  }

  // Only set up Socket.IO listeners once to avoid duplicates
  if (!socketIOInitialized) {
    socketIOInitialized = true;

    // Socket.IO authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.error("Socket.IO: No token provided");
        return next(new Error("Authentication token required"));
      }

      try {
        const decoded = verifyToken(token);
        if (!decoded) {
          console.error(
            "Socket.IO: Token verification failed - invalid or expired",
          );
          return next(new Error("Invalid or expired token"));
        }

        // Attach user info to socket
        (socket as any).userId = decoded.id;
        (socket as any).email = decoded.email;
        (socket as any).role = decoded.role;

        console.log(`Socket.IO: User ${decoded.id} authenticated successfully`);
        next();
      } catch (error) {
        console.error("Socket.IO auth error:", error);
        return next(new Error("Authentication failed"));
      }
    });

    // WebSocket setup for real-time chat
    io.on("connection", (socket) => {
      const userId = (socket as any).userId;
      console.log(`User connected: ${socket.id} (User ID: ${userId})`);

      // User joins a chat room
      socket.on("join-chat", (data: { chatId: string; userId: string }) => {
        socket.join(data.chatId);
        console.log(`User ${data.userId} joined chat ${data.chatId}`);
        socket.broadcast.to(data.chatId).emit("user-joined", {
          userId: data.userId,
          timestamp: new Date().toISOString(),
        });
      });

      // User sends a message
      socket.on(
        "send-message",
        (data: {
          messageId: string;
          sender: string;
          senderName: string;
          chatId: string;
          content: string;
          timestamp: string;
        }) => {
          io.to(data.chatId).emit("new-message", data);
        },
      );

      // User is typing
      socket.on(
        "typing",
        (data: {
          chatId: string;
          userId: string;
          senderName: string;
          isTyping: boolean;
        }) => {
          socket.broadcast.to(data.chatId).emit("user-typing", {
            userId: data.userId,
            senderName: data.senderName,
            isTyping: data.isTyping,
          });
        },
      );

      // User marks message as read
      socket.on("message-read", (data: { messageId: string; userId: string }) => {
        io.emit("message-read", data);
      });

      // User edits a message
      socket.on(
        "edit-message",
        (data: { messageId: string; content: string; chatId: string }) => {
          io.to(data.chatId).emit("message-edited", data);
        },
      );

      // User deletes a message
      socket.on(
        "delete-message",
        (data: { messageId: string; chatId: string }) => {
          io.to(data.chatId).emit("message-deleted", data);
        },
      );

      // User leaves a chat
      socket.on("leave-chat", (data: { chatId: string }) => {
        socket.leave(data.chatId);
        console.log(`User left chat ${data.chatId}`);
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
      });

      // Handle connection errors
      socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });

    // Handle Socket.IO connection errors
    io.on("error", (error) => {
      console.error("Socket.IO server error:", error);
    });
  }

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Middleware to populate teamId and role from database (after auth middleware)
  app.use((req, res, next) => {
    // This will be set by authMiddleware, we just ensure it's available
    next();
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Authentication routes
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/signup", handleSignup);

  // Protected routes
  app.use("/api/queued", authMiddleware);
  app.use("/api/history", authMiddleware);
  app.use("/api/chat", authMiddleware);
  app.use("/api/members", authMiddleware);
  app.use("/api/profile", authMiddleware);
  app.use("/api/team", authMiddleware);
  app.use("/api/sorter", authMiddleware);

  // Queued list routes
  app.post("/api/queued/add", addToQueue);
  app.get("/api/queued", getQueuedLines);
  app.delete("/api/queued/:lineId", clearQueuedLine);
  app.delete("/api/queued", clearAllQueuedLines);
  app.post("/api/queued/claim", claimLines);

  // History routes
  app.post("/api/history/add", addToHistory);
  app.get("/api/history", getHistory);
  app.get("/api/history/search", searchHistory);

  // Chat routes
  app.get("/api/chat/group", getOrCreateGroupChat);
  app.post("/api/chat/send", sendMessage);
  app.get("/api/chat/messages", getMessages);
  app.post("/api/chat/group/add-member", addMemberToGroup);
  app.post("/api/chat/typing", setTyping);
  app.get("/api/chat/typing", getTypingStatus);
  app.post("/api/chat/mark-read", markMessageAsRead);
  app.post("/api/chat/edit", editMessage);
  app.post("/api/chat/delete", deleteMessage);

  // Member routes
  app.get("/api/members", getTeamMembers);
  app.post("/api/members", createTeamMember);

  // Profile routes
  app.get("/api/profile", getProfile);
  app.post("/api/profile/upload-picture", uploadProfilePicture);
  app.post("/api/profile/update", updateProfile);

  // Team management routes
  app.post("/api/team/create-member", createTeamMemberAdmin);
  app.get("/api/team/members", getTeamMembersAdmin);
  app.post("/api/team/edit-member", editTeamMember);
  app.post("/api/team/toggle-block", toggleBlockTeamMember);
  app.post("/api/team/remove-member", removeTeamMember);

  // Sorter settings routes
  app.get("/api/sorter/settings", getSorterSettings);
  app.post("/api/sorter/settings", updateSorterSettings);

  return app;
}
