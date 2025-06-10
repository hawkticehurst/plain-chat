import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as dotenv from "dotenv";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { serveStatic } from "hono/serve-static";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config({ path: ".env.local" });

const app = new Hono();
const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

// Enable CORS for development
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Apply Clerk middleware only if environment variables are configured
const hasClerkConfig =
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY;

if (hasClerkConfig) {
  app.use("*", clerkMiddleware());
  console.log("✅ Clerk authentication enabled");
} else {
  console.log(
    "⚠️  Clerk authentication disabled - missing environment variables"
  );
  console.log(
    "   Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY in .env.local to enable auth"
  );
}

// Serve static files from the appropriate directory
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  // Production: Serve built files from dist
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.use("/vite.svg", serveStatic({ root: "./dist" }));
} else {
  // Development: Serve public files and handle the case where someone accesses the backend directly
  app.use("/vite.svg", serveStatic({ root: "./public" }));

  // For development, we recommend using Vite dev server on localhost:5173
  // But if someone accesses this server directly, show a helpful message
  app.get("/", (c) => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Plain Chat - Backend Server</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .banner { background: #007aff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .info { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 10px 0; }
            code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="banner">
            <h1>🚀 Chat App Backend Server</h1>
            <p>This is the backend API server running on port 3000</p>
          </div>
          
          <div class="info">
            <h3>✅ Server Status</h3>
            <p>✅ Backend API server is running</p>
            <p>✅ CORS configured for development</p>
            <p>✅ Authentication: ${hasClerkConfig ? "Enabled" : "Demo Mode"}</p>
            <p>✅ Database: ${process.env.CONVEX_URL ? "Connected to Convex" : "Demo Mode"}</p>
          </div>

          <div class="info">
            <h3>🔧 Development Workflow</h3>
            <p><strong>For frontend development with hot reload:</strong></p>
            <ol>
              <li>Run: <code>npm run dev</code></li>
              <li>Open: <a href="http://localhost:5173" target="_blank">http://localhost:5173</a></li>
            </ol>
            
            <p><strong>API Endpoints (this server):</strong></p>
            <ul>
              <li><a href="/api/auth/status">/api/auth/status</a> - Authentication status</li>
              <li><a href="/api/messages">/api/messages</a> - Chat messages</li>
            </ul>
          </div>

          <div class="info">
            <h3>📦 Production Mode</h3>
            <p>To test the full-stack build:</p>
            <ol>
              <li>Run: <code>npm run build</code></li>
              <li>Run: <code>npm start</code></li>
              <li>Open: <a href="http://localhost:3000" target="_blank">http://localhost:3000</a></li>
            </ol>
          </div>
        </body>
      </html>
    `);
  });
}

// API Routes
app.get("/api/auth/status", (c) => {
  if (!hasClerkConfig) {
    return c.json({
      isAuthenticated: false,
      userId: null,
      message:
        "Authentication is disabled - Configure Clerk environment variables to enable.",
    });
  }

  const auth = getAuth(c);

  return c.json({
    isAuthenticated: !!auth?.userId,
    userId: auth?.userId || null,
  });
});

app.get("/api/messages", async (c) => {
  if (!hasClerkConfig) {
    // Return demo data when auth is disabled
    try {
      const messages = await client.query(api.tasks.get);
      return c.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      // Return demo messages if Convex is also not configured
      return c.json({
        messages: [
          {
            role: "response",
            content:
              "Welcome to the chat app! Configure your environment variables to enable full functionality.",
          },
          {
            role: "response",
            content:
              "Demo mode: Authentication and real-time sync are currently disabled.",
          },
        ],
      });
    }
  }

  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const messages = await client.query(api.tasks.get);
    return c.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }
});

// AI Settings API Routes
app.get("/api/ai/has-valid-key", async (c) => {
  if (!hasClerkConfig) {
    // Demo mode - return false for now
    return c.json({ hasValidKey: false });
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const hasKey = await client.query(api.aiKeys.hasValidApiKey);
    return c.json({ hasValidKey: hasKey });
  } catch (error) {
    console.error("Error checking API key:", error);
    return c.json({ error: "Failed to check API key" }, 500);
  }
});

app.get("/api/ai/key-status", async (c) => {
  if (!hasClerkConfig) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const keyStatus = await client.query(api.aiKeys.getApiKeyStatus);
    return c.json(keyStatus);
  } catch (error) {
    console.error("Error fetching key status:", error);
    return c.json({ error: "Failed to fetch key status" }, 500);
  }
});

app.get("/api/ai/preferences", async (c) => {
  if (!hasClerkConfig) {
    // Demo mode - return default preferences
    return c.json({
      defaultModel: "google/gemini-2.0-flash-exp",
      temperature: 0.7,
      maxTokens: 2000,
      enableStreaming: true,
      systemPrompt: "",
    });
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const preferences = await client.query(api.aiKeys.getUserAIPreferences);
    return c.json(
      preferences || {
        defaultModel: "google/gemini-2.0-flash-exp",
        temperature: 0.7,
        maxTokens: 2000,
        enableStreaming: true,
        systemPrompt: "",
      }
    );
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return c.json({ error: "Failed to fetch preferences" }, 500);
  }
});

app.post("/api/ai/preferences", async (c) => {
  if (!hasClerkConfig) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    await client.mutation(api.aiKeys.setUserAIPreferences, body);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving preferences:", error);
    return c.json({ error: "Failed to save preferences" }, 500);
  }
});

app.post("/api/ai/test-key", async (c) => {
  if (!hasClerkConfig) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ valid: false, error: "API key required" });
    }

    const result = await client.action(api.cryptoActions.testApiKey, {
      apiKey,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error testing API key:", error);
    return c.json({ valid: false, error: "Failed to test API key" });
  }
});

app.post("/api/ai/set-key", async (c) => {
  if (!hasClerkConfig) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ error: "API key required" }, 400);
    }

    await client.action(api.cryptoActions.setUserApiKey, {
      apiKey,
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error setting API key:", error);
    return c.json({ error: "Failed to set API key" }, 500);
  }
});

// Serve the SPA for all other routes (production only)
if (isProduction) {
  app.get("*", (c) => {
    try {
      const htmlPath = join(process.cwd(), "dist", "index.html");
      const html = readFileSync(htmlPath, "utf-8");
      return c.html(html);
    } catch (error) {
      console.error("Error serving SPA:", error);
      return c.text("Error loading application", 500);
    }
  });
}

const port = process.env.PORT || 3000;

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  serve({
    fetch: app.fetch,
    port,
  });
  console.log(`🚀 Server running on http://localhost:${port}`);
}

export default {
  port,
  fetch: app.fetch,
};
