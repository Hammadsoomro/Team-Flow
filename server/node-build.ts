import path from "path";
import { createServer, getHttpServer } from "./index";
import { closeDB } from "./db";
import * as express from "express";

async function startServer() {
  try {
    const app = await createServer();
    const httpServer = getHttpServer();
    const port = process.env.PORT || 3000;

    // In production, serve the built SPA files
    const __dirname = import.meta.dirname;
    const distPath = path.join(__dirname, "../spa");

    // Serve static files
    app.use(express.static(distPath));

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok" });
    });

    // Handle React Router - serve index.html for all non-API routes
    app.get("*", (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith("/api/") || req.path.startsWith("/socket.io")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }

      res.sendFile(path.join(distPath, "index.html"));
    });

    // Listen on all network interfaces (0.0.0.0) for Fly.io compatibility
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Fusion Starter server running on port ${port}`);
      console.log(`📱 Frontend: http://0.0.0.0:${port}`);
      console.log(`🔧 API: http://0.0.0.0:${port}/api`);
      console.log(`🔗 WebSocket: ws://0.0.0.0:${port}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("🛑 Received SIGTERM, shutting down gracefully");
      await closeDB();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("🛑 Received SIGINT, shutting down gracefully");
      await closeDB();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
