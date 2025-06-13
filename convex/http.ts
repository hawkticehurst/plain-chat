// convex/http.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ActionCtx } from "./_generated/server";

// Import all HTTP action handlers
import { getAuthStatus } from "./httpActions/auth";

import {
  hasValidKey,
  getKeyStatus,
  getPreferences,
  setPreferences,
  testKey,
  setKey,
} from "./httpActions/aiSettings";

import {
  getChats,
  createChat,
  deleteChat,
  updateChatTitle,
  generateChatTitle,
} from "./httpActions/chats";

import {
  getChatMessages,
  addMessage,
  getMessage,
} from "./httpActions/messages";

import { streamChat } from "./httpActions/streaming";

import {
  getRecentUsage,
  getDailyUsage,
  getMonthlyUsage,
} from "./httpActions/usage";

const app: HonoWithConvex<ActionCtx> = new Hono();

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://plain-chat.pages.dev",
      "https://chat.hawkticehurst.com"
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Helper function to convert Convex HTTP actions to Hono handlers
const convertHttpAction = (action: any) => {
  return async (c: any) => {
    // Extract parameters from Hono
    const params = c.req.param();

    // Create a URL with the parameters embedded in query string for easy access
    const url = new URL(c.req.url);

    // Add parameters as a special header that our Convex actions can read
    const headers = new Headers(c.req.headers);
    if (Object.keys(params).length > 0) {
      headers.set("x-route-params", JSON.stringify(params));
    }

    // Create a Request object that Convex expects
    const request = new Request(url.toString(), {
      method: c.req.method,
      headers: headers,
      body:
        c.req.method !== "GET" && c.req.method !== "HEAD"
          ? await c.req.raw.clone().text()
          : undefined,
    });

    // Create the Convex context
    const ctx = {
      auth: c.env.auth,
      runQuery: c.env.runQuery,
      runMutation: c.env.runMutation,
      runAction: c.env.runAction,
    };

    // Call the Convex HTTP action
    const response = await action(ctx, request);
    return response;
  };
};

// Auth routes
app.get("/auth/status", convertHttpAction(getAuthStatus));
app.options("/auth/status", convertHttpAction(getAuthStatus));

// AI Settings routes
app.get("/ai-settings/has-valid-key", convertHttpAction(hasValidKey));
app.get("/ai-settings/key-status", convertHttpAction(getKeyStatus));
app.get("/ai-settings/preferences", convertHttpAction(getPreferences));
app.post("/ai-settings/preferences", convertHttpAction(setPreferences));
app.post("/ai-settings/test-key", convertHttpAction(testKey));
app.post("/ai-settings/set-key", convertHttpAction(setKey));

// Chats routes
app.get("/chats", convertHttpAction(getChats));
app.options("/chats", convertHttpAction(getChats));
app.post("/chats", convertHttpAction(createChat));
app.delete("/chats/:chatId", convertHttpAction(deleteChat));
app.patch("/chats/:chatId/title", convertHttpAction(updateChatTitle));
app.post("/chats/:chatId/generate-title", convertHttpAction(generateChatTitle));

// Messages routes - now with proper dynamic routing!
app.get("/chats/:chatId/messages", convertHttpAction(getChatMessages));
app.options("/chats/:chatId/messages", convertHttpAction(getChatMessages));
app.post("/chats/:chatId/messages", convertHttpAction(addMessage));

// Single message route for polling updates
app.get("/messages/:messageId", convertHttpAction(getMessage));
app.options("/messages/:messageId", convertHttpAction(getMessage));

// Streaming routes
app.post("/chats/:chatId/stream", convertHttpAction(streamChat));
app.options("/chats/:chatId/stream", convertHttpAction(streamChat));

// Usage routes
app.get("/usage/recent", convertHttpAction(getRecentUsage));
app.get("/usage/daily", convertHttpAction(getDailyUsage));
app.get("/usage/monthly", convertHttpAction(getMonthlyUsage));

export default new HttpRouterWithHono(app);
