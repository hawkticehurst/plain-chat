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
  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ valid: false, error: "API key required" });
    }

    // In demo mode, we can still test API keys directly without Convex
    if (!hasClerkConfig) {
      // Validate format first
      const validateOpenRouterKeyFormat = (key) => {
        const pattern = /^sk-or-[A-Za-z0-9+/=_-]{20,}$/;
        return pattern.test(key) && key.length >= 32;
      };

      if (!validateOpenRouterKeyFormat(apiKey)) {
        return c.json({ valid: false, error: "Invalid API key format" });
      }

      // Test the key directly with OpenRouter
      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.SITE_URL || "https://localhost:3000",
              "X-Title": "Chat App",
            },
            body: JSON.stringify({
              model: "openai/gpt-3.5-turbo",
              messages: [{ role: "user", content: "Hello" }],
              max_tokens: 5,
            }),
          }
        );

        if (response.ok) {
          return c.json({ valid: true });
        } else {
          const errorData = await response.json();
          return c.json({
            valid: false,
            error: errorData.error?.message || `HTTP ${response.status}`,
          });
        }
      } catch (fetchError) {
        return c.json({
          valid: false,
          error: fetchError.message || "Network error",
        });
      }
    }

    // Authenticated mode - use Convex action
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
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
  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ error: "API key required" }, 400);
    }

    // In demo mode, we can't actually store the key, but we can validate it
    if (!hasClerkConfig) {
      // Just validate the format and return success for demo
      const validateOpenRouterKeyFormat = (key) => {
        const pattern = /^sk-or-[A-Za-z0-9+/=_-]{20,}$/;
        return pattern.test(key) && key.length >= 32;
      };

      if (!validateOpenRouterKeyFormat(apiKey)) {
        return c.json({ error: "Invalid API key format" }, 400);
      }

      // In demo mode, we simulate saving but warn the user
      return c.json({ 
        success: true, 
        demo: true,
        message: "Demo mode: API key validated but not permanently stored. Enable authentication to save keys securely."
      });
    }

    // Authenticated mode - actually store the key
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
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

// Usage API endpoints
app.get("/api/usage/recent", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const limit = parseInt(c.req.query("limit") || "20");
    const usage = await client.query(api.usage.getRecentUsage, { limit });
    return c.json({ usage });
  } catch (error) {
    console.error("Error fetching recent usage:", error);
    return c.json({ error: "Failed to fetch recent usage" }, 500);
  }
});

app.get("/api/usage/daily", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const days = parseInt(c.req.query("days") || "7");
    const summary = await client.query(api.usage.getUserUsageSummary, { days });
    return c.json({ summary: summary?.dailySummaries || [] });
  } catch (error) {
    console.error("Error fetching daily usage:", error);
    return c.json({ error: "Failed to fetch daily usage" }, 500);
  }
});

app.get("/api/usage/monthly", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const months = parseInt(c.req.query("months") || "3");
    const days = months * 30; // Approximate conversion
    const summary = await client.query(api.usage.getUserUsageSummary, { days });

    // Group daily summaries by month
    const monthlyData = {};
    if (summary?.dailySummaries) {
      summary.dailySummaries.forEach((day) => {
        const monthKey = day.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            _id: monthKey,
            date: monthKey,
            totalTokens: 0,
            totalCost: 0,
            requestCount: 0,
            modelUsage: {},
          };
        }

        monthlyData[monthKey].totalTokens += day.totalTokens;
        monthlyData[monthKey].totalCost += day.totalCost;
        monthlyData[monthKey].requestCount += day.requestCount;

        // Merge model usage
        Object.entries(day.modelUsage).forEach(([model, tokens]) => {
          if (!monthlyData[monthKey].modelUsage[model]) {
            monthlyData[monthKey].modelUsage[model] = {
              tokens: 0,
              cost: 0,
              requests: 0,
            };
          }
          monthlyData[monthKey].modelUsage[model].tokens += tokens;
          // Estimate cost and requests proportionally
          monthlyData[monthKey].modelUsage[model].cost +=
            (day.totalCost * tokens) / day.totalTokens;
          monthlyData[monthKey].modelUsage[model].requests += Math.ceil(
            (day.requestCount * tokens) / day.totalTokens
          );
        });
      });
    }

    const monthlySummaries = Object.values(monthlyData);
    return c.json({ summary: monthlySummaries });
  } catch (error) {
    console.error("Error fetching monthly usage:", error);
    return c.json({ error: "Failed to fetch monthly usage" }, 500);
  }
});

// AI Chat API endpoint
app.post("/api/ai/chat", async (c) => {
  const auth = getAuth(c);
  
  // In demo mode, allow chat but use demo responses
  if (!hasClerkConfig) {
    try {
      const { message, conversation = [] } = await c.req.json();
      
      // Simple demo AI response
      const demoResponses = [
        "This is a demo response! Configure your AI API key in Settings to use real AI.",
        "I'm a demo AI assistant. Set up your API key to unlock my full potential!",
        "Demo mode active. Your message was: '" + message + "' - Configure AI settings for real responses.",
        "Hello! This is a simulated response. Enable authentication and configure your AI API key for real conversations.",
      ];
      
      const response = demoResponses[Math.floor(Math.random() * demoResponses.length)];
      
      return c.json({
        response,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cost: 0.0001
        }
      });
    } catch (error) {
      console.error("Error in demo chat:", error);
      return c.json({ error: "Failed to process demo chat" }, 500);
    }
  }

  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { message, conversation = [] } = await c.req.json();
    
    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    // Get user's AI preferences and API key
    const preferences = await client.query(api.aiKeys.getUserAIPreferences);
    const hasValidKey = await client.query(api.aiKeys.hasValidApiKey);
    
    if (!hasValidKey) {
      return c.json({ error: "No valid API key configured. Please set up your AI API key in Settings." }, 400);
    }

    // Use the server-side AI completion action
    const result = await client.action(api.cryptoActions.performAICompletion, {
      message,
      conversation: conversation.slice(-10), // Keep last 10 messages for context
      preferences: preferences || {
        defaultModel: "google/gemini-2.0-flash-exp",
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: ""
      }
    });

    // Record usage if successful
    if (result.success && result.usage) {
      await client.mutation(api.usage.recordUsage, {
        model: result.model || preferences?.defaultModel || "google/gemini-2.0-flash-exp",
        promptTokens: result.usage.promptTokens || 0,
        completionTokens: result.usage.completionTokens || 0,
        totalTokens: result.usage.totalTokens || 0,
        cost: result.usage.cost || 0,
        success: true,
        requestId: result.requestId
      });
    } else if (!result.success) {
      // Record failed usage
      await client.mutation(api.usage.recordUsage, {
        model: preferences?.defaultModel || "google/gemini-2.0-flash-exp",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        success: false,
        errorMessage: result.error,
        requestId: result.requestId
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("Error in AI chat:", error);
    
    // Record failed usage for unexpected errors
    try {
      await client.mutation(api.usage.recordUsage, {
        model: "unknown",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        success: false,
        errorMessage: error.message || "Internal server error"
      });
    } catch (usageError) {
      console.error("Error recording failed usage:", usageError);
    }
    
    return c.json({ error: "Failed to process AI request" }, 500);
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
