import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { serveStatic } from "hono/serve-static";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app = new Hono();
const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

// Helper function to create authenticated Convex client
async function getAuthenticatedConvexClient(auth) {
  if (!auth?.userId) {
    throw new Error("User not authenticated");
  }

  const token = await auth.getToken({ template: "convex" });
  if (!token) {
    throw new Error("Failed to get authentication token");
  }

  const authenticatedClient = new ConvexHttpClient(process.env["CONVEX_URL"]);
  authenticatedClient.setAuth(token);
  return authenticatedClient;
}

// Helper function to get either authenticated or regular client based on need
async function getConvexClient(auth, requireAuth = true) {
  if (requireAuth || auth?.userId) {
    return await getAuthenticatedConvexClient(auth);
  }
  return client;
}

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

// Check for required Clerk environment variables
if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
  console.error("❌ Missing required Clerk environment variables:");
  console.error(
    "   CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY must be set in .env.local"
  );
  console.error(
    "   Please configure these variables before starting the server."
  );
  process.exit(1);
}

// Apply Clerk middleware
app.use("*", clerkMiddleware());

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
            <p>✅ Authentication: Enabled</p>
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
  const auth = getAuth(c);

  return c.json({
    isAuthenticated: !!auth?.userId,
    userId: auth?.userId || null,
  });
});

// AI Settings API Routes
app.get("/api/ai/has-valid-key", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const convexClient = await getConvexClient(auth);
    const hasKey = await convexClient.query(api.aiKeys.hasValidApiKey);
    return c.json({ hasValidKey: hasKey });
  } catch (error) {
    console.error("Error checking API key:", error);
    return c.json({ error: "Failed to check API key" }, 500);
  }
});

app.get("/api/ai/key-status", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const convexClient = await getConvexClient(auth);
    const keyStatus = await convexClient.query(api.aiKeys.getApiKeyStatus);
    return c.json(keyStatus);
  } catch (error) {
    console.error("Error fetching key status:", error);
    return c.json({ error: "Failed to fetch key status" }, 500);
  }
});

app.get("/api/ai/preferences", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const convexClient = await getConvexClient(auth);
    const preferences = await convexClient.query(
      api.aiKeys.getUserAIPreferences
    );

    // Handle model name migration from old to new
    if (
      preferences &&
      preferences.defaultModel === "google/gemini-2.0-flash-exp"
    ) {
      preferences.defaultModel = "google/gemini-2.5-flash-preview-05-20";
    }

    return c.json(
      preferences || {
        defaultModel: "google/gemini-2.5-flash-preview-05-20",
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
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const convexClient = await getConvexClient(auth);
    await convexClient.mutation(api.aiKeys.setUserAIPreferences, body);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving preferences:", error);
    return c.json({ error: "Failed to save preferences" }, 500);
  }
});

app.post("/api/ai/test-key", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ valid: false, error: "API key required" });
    }

    // Get authenticated Convex client
    const authenticatedClient = await getAuthenticatedConvexClient(auth);

    const result = await authenticatedClient.action(
      api.cryptoActions.testApiKey,
      {
        apiKey,
      }
    );
    return c.json(result);
  } catch (error) {
    console.error("Error testing API key:", error);
    return c.json({ valid: false, error: "Failed to test API key" });
  }
});

app.post("/api/ai/set-key", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { apiKey } = await c.req.json();
    if (!apiKey) {
      return c.json({ error: "API key required" }, 400);
    }

    // Get authenticated Convex client
    const authenticatedClient = await getAuthenticatedConvexClient(auth);

    await authenticatedClient.action(api.cryptoActions.setUserApiKey, {
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
    const convexClient = await getConvexClient(auth);
    const usage = await convexClient.query(api.usage.getRecentUsage, { limit });
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
    const convexClient = await getConvexClient(auth);
    const summary = await convexClient.query(api.usage.getUserUsageSummary, {
      days,
    });
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
    const convexClient = await getConvexClient(auth);
    const summary = await convexClient.query(api.usage.getUserUsageSummary, {
      days,
    });

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

// AI Chat Streaming API endpoint (SSE)
app.post("/api/ai/chat/stream", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { message, conversation = [] } = await c.req.json();

    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    // Get authenticated Convex client
    const convexClient = await getConvexClient(auth);

    // Get user's AI preferences
    const preferences = await convexClient.query(
      api.aiKeys.getUserAIPreferences
    );

    // Handle model name migration from old to new
    if (
      preferences &&
      preferences.defaultModel === "google/gemini-2.0-flash-exp"
    ) {
      preferences.defaultModel = "google/gemini-2.5-flash-preview-05-20";
    }

    const hasValidKey = await convexClient.query(api.aiKeys.hasValidApiKey);

    if (!hasValidKey) {
      return c.json(
        {
          error:
            "No valid API key configured. Please set up your AI API key in Settings.",
        },
        400
      );
    }

    // Get streaming preparation data
    const streamData = await convexClient.action(
      api.cryptoActions.performStreamingAICompletion,
      {
        message,
        conversation: conversation.slice(-10), // Keep last 10 messages for context
        preferences: preferences
          ? {
              defaultModel: preferences.defaultModel,
              temperature: preferences.temperature,
              maxTokens: preferences.maxTokens,
              systemPrompt: preferences.systemPrompt,
            }
          : {
              defaultModel: "google/gemini-2.5-flash-preview-05-20",
              temperature: 0.7,
              maxTokens: 2000,
              systemPrompt: "",
            },
      }
    );

    if (!streamData.success) {
      return c.json({ error: streamData.error }, 400);
    }

    // Set up SSE headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Headers", "Cache-Control");

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;
        let streamFinished = false;

        try {
          // Make streaming request to OpenRouter
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${streamData.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer":
                  process.env.SITE_URL || "https://localhost:3000",
                "X-Title": "Chat App - Streaming",
              },
              body: JSON.stringify({
                model: streamData.preferences.defaultModel,
                messages: streamData.messages,
                temperature: streamData.preferences.temperature,
                max_tokens: streamData.preferences.maxTokens,
                stream: true,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `AI API error: ${
              errorData.error?.message || `HTTP ${response.status}`
            }`;

            controller.enqueue(
              `data: ${JSON.stringify({
                type: "error",
                error: errorMessage,
                requestId: streamData.requestId,
              })}\n\n`
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: "error",
                error: "No response stream available",
                requestId: streamData.requestId,
              })}\n\n`
            );
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let contentBuffer = "";
          let lastSentTime = Date.now();
          const BATCH_INTERVAL = 75; // Send batched content every 75ms

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              streamFinished = true;
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);

                if (data === "[DONE]") {
                  streamFinished = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const choice = parsed.choices?.[0];

                  if (choice?.delta?.content) {
                    const content = choice.delta.content;
                    fullResponse += content;
                    contentBuffer += content;

                    // Send batched content to reduce jitter
                    const now = Date.now();
                    if (
                      now - lastSentTime >= BATCH_INTERVAL ||
                      contentBuffer.length >= 10
                    ) {
                      controller.enqueue(
                        `data: ${JSON.stringify({
                          type: "content",
                          content: contentBuffer,
                          requestId: streamData.requestId,
                        })}\n\n`
                      );
                      contentBuffer = "";
                      lastSentTime = now;
                    }
                  }

                  // Track usage data
                  if (parsed.usage) {
                    promptTokens = parsed.usage.prompt_tokens || 0;
                    completionTokens = parsed.usage.completion_tokens || 0;
                    totalTokens = parsed.usage.total_tokens || 0;
                  }
                } catch (parseError) {
                  // Ignore parse errors for individual chunks
                  continue;
                }
              }
            }

            if (streamFinished) break;
          }

          // Send any remaining buffered content
          if (contentBuffer.length > 0) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: "content",
                content: contentBuffer,
                requestId: streamData.requestId,
              })}\n\n`
            );
          }

          // Send completion message
          controller.enqueue(
            `data: ${JSON.stringify({
              type: "complete",
              content: fullResponse,
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
                cost: totalTokens * 0.000001, // Rough estimate
              },
              requestId: streamData.requestId,
            })}\n\n`
          );

          // Record successful usage
          try {
            await convexClient.mutation(api.usage.recordUsage, {
              model: streamData.preferences.defaultModel,
              promptTokens,
              completionTokens,
              totalTokens,
              cost: totalTokens * 0.000001,
              success: true,
              requestId: streamData.requestId,
            });
          } catch (usageError) {
            console.error("Error recording usage:", usageError);
          }
        } catch (error) {
          console.error("Streaming error:", error);

          controller.enqueue(
            `data: ${JSON.stringify({
              type: "error",
              error: error.message || "Streaming failed",
              requestId: streamData.requestId,
            })}\n\n`
          );

          // Record failed usage
          try {
            await convexClient.mutation(api.usage.recordUsage, {
              model: streamData.preferences.defaultModel,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: 0,
              success: false,
              errorMessage: error.message || "Streaming failed",
              requestId: streamData.requestId,
            });
          } catch (usageError) {
            console.error("Error recording failed usage:", usageError);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });
  } catch (error) {
    console.error("Error in streaming AI chat:", error);
    return c.json({ error: "Failed to start streaming" }, 500);
  }
});

// Chat API endpoints
app.get("/api/chats", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const convexClient = await getConvexClient(auth);
    const chats = await convexClient.query(api.chats.getUserChats);
    return c.json({ chats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return c.json({ error: "Failed to fetch chats" }, 500);
  }
});

app.post("/api/chats", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { title } = await c.req.json();
    const convexClient = await getConvexClient(auth);
    const chatId = await convexClient.mutation(api.chats.createChat, {
      title: title || "New Conversation",
    });
    return c.json({ chatId });
  } catch (error) {
    console.error("Error creating chat:", error);
    return c.json({ error: "Failed to create chat" }, 500);
  }
});

app.get("/api/chats/:chatId/messages", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const chatId = c.req.param("chatId");
    const convexClient = await getConvexClient(auth);
    const messages = await convexClient.query(api.messages.getChatMessages, {
      chatId: chatId,
    });
    return c.json({ messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }
});

app.post("/api/chats/:chatId/messages", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const chatId = c.req.param("chatId");
    const { role, content, aiMetadata } = await c.req.json();
    const convexClient = await getConvexClient(auth);
    const messageId = await convexClient.mutation(api.messages.addMessage, {
      chatId: chatId,
      role,
      content,
      aiMetadata,
    });
    return c.json({ messageId });
  } catch (error) {
    console.error("Error adding message:", error);
    return c.json({ error: "Failed to add message" }, 500);
  }
});

app.patch("/api/chats/:chatId/title", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const chatId = c.req.param("chatId");
    const { title } = await c.req.json();
    const convexClient = await getConvexClient(auth);
    await convexClient.mutation(api.chats.updateChatTitle, {
      chatId: chatId,
      title,
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating chat title:", error);
    return c.json({ error: "Failed to update title" }, 500);
  }
});

app.post("/api/chats/:chatId/generate-title", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const chatId = c.req.param("chatId");
    const { firstMessage } = await c.req.json();
    const convexClient = await getConvexClient(auth);

    // Generate title using AI
    const result = await convexClient.action(
      api.cryptoActions.generateChatTitle,
      {
        firstMessage,
      }
    );

    if (result.success) {
      // Update the chat title
      await convexClient.mutation(api.chats.updateChatTitle, {
        chatId: chatId,
        title: result.title,
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("Error generating chat title:", error);
    return c.json(
      {
        success: false,
        error: "Failed to generate title",
        title: "New Conversation",
      },
      500
    );
  }
});

app.delete("/api/chats/:chatId", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const chatId = c.req.param("chatId");
    const convexClient = await getConvexClient(auth);
    await convexClient.mutation(api.chats.deleteChat, {
      chatId: chatId,
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return c.json({ error: "Failed to delete chat" }, 500);
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
