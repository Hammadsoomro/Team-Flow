import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [".env", ".env.*", ".", "./client", "./shared"],
      deny: ["*.{crt,pem}", "**/.git/**", "server/**"],
    },
    middlewareMode: false,
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer(server) {
      try {
        // Initialize the Express server during configuration
        const app = await createServer();
        console.log("[Vite] Express API server initialized");

        // Use a pre middleware to handle API requests
        server.middlewares.use((req, res, next) => {
          // Only route API requests through Express
          if (req.url.startsWith("/api") || req.url.startsWith("/socket.io")) {
            return app(req, res);
          }
          next();
        });
      } catch (error) {
        console.error("[Vite] Failed to initialize Express server:", error);
        throw error;
      }
    },
  };
}
