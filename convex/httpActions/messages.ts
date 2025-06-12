import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

// CORS headers for cross-origin requests
const getCorsHeaders = (isDev = false) => {
  const allowedOrigins = isDev
    ? [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
      ]
    : ["https://your-production-domain.com"]; // Replace with your actual production domain

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": isDev ? "*" : allowedOrigins[0], // More restrictive in prod
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
};

/**
 * Helper function to extract chat ID from Hono route parameters
 */
function extractChatId(request: Request): string {
  const routeParams = request.headers.get("x-route-params");
  if (routeParams) {
    const params = JSON.parse(routeParams);
    if (params.chatId) {
      return params.chatId;
    }
  }

  // Fallback to URL parsing if route params not available
  const pathParts = request.url.split("/");
  const chatsIndex = pathParts.findIndex((part) => part === "chats");
  if (chatsIndex !== -1 && pathParts[chatsIndex + 1]) {
    return pathParts[chatsIndex + 1];
  }
  throw new Error("Chat ID not found in URL or route parameters");
}

/**
 * Get messages for a chat
 * GET /chats/:chatId/messages
 */
export const getChatMessages = httpAction(async (ctx, request) => {
  const isDev = process.env.NODE_ENV !== "production";

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: getCorsHeaders(isDev),
      });
    }

    const chatId = extractChatId(request);
    const messages = await ctx.runQuery(api.messages.getChatMessages, {
      chatId: chatId as any,
    });

    return new Response(JSON.stringify({ messages }), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching chat messages:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch messages" }), {
      status: 500,
      headers: getCorsHeaders(isDev),
    });
  }
});

/**
 * Add message to chat
 * POST /chats/:chatId/messages
 */
export const addMessage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const chatId = extractChatId(request);
    const { role, content, aiMetadata } = await request.json();

    const messageId = await ctx.runMutation(api.messages.addUserMessage, {
      chatId: chatId as any,
      role,
      content,
      aiMetadata,
    });

    return new Response(JSON.stringify({ messageId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error adding message:", error);
    return new Response(JSON.stringify({ error: "Failed to add message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
