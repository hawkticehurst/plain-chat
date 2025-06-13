import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

// CORS headers for cross-origin requests
const getCorsHeaders = (isDev = false) => {
  const allowedOrigins = isDev
    ? [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
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
  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(true),
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(true),
    });
  }

  try {
    const chatId = extractChatId(request);
    const requestBody = await request.json();
    const {
      role,
      content,
      aiMetadata,
      message,
      conversation = [],
      useConvexStreaming = false,
    } = requestBody;

    // Handle the new Convex streaming pattern
    if (useConvexStreaming && message) {
      console.log(`[Messages] Using Convex streaming for chat ${chatId}`);

      // Add user message first
      const userMessageId = await ctx.runMutation(api.messages.addUserMessage, {
        chatId: chatId as any,
        role: "prompt",
        content: message,
      });

      // Create AI message with scheduled streaming
      const aiMessageId = await ctx.runMutation(
        api.messages.createAIMessageWithStreaming,
        {
          chatId: chatId as any,
          userMessage: message,
          conversation,
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          userMessageId,
          messageId: aiMessageId,
          message: "AI response scheduled with Convex streaming",
        }),
        {
          status: 200,
          headers: getCorsHeaders(true),
        }
      );
    } else {
      // Handle the original simple message adding
      const messageId = await ctx.runMutation(api.messages.addUserMessage, {
        chatId: chatId as any,
        role: role || "prompt",
        content: content || message,
        aiMetadata,
      });

      return new Response(JSON.stringify({ messageId }), {
        headers: getCorsHeaders(true),
        status: 200,
      });
    }
  } catch (error: any) {
    console.error("Error adding message:", error);
    return new Response(JSON.stringify({ error: "Failed to add message" }), {
      status: 500,
      headers: getCorsHeaders(true),
    });
  }
});

// Get a single message by ID (for polling updates)
export const getMessage = httpAction(async (ctx, request) => {
  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(true),
    });
  }

  // Check authentication
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(true),
    });
  }

  // Extract messageId from route parameters
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  let messageId = pathParts[pathParts.length - 1];

  // Handle the case where route params are passed via headers (from Hono)
  const routeParamsHeader = request.headers.get("x-route-params");
  if (routeParamsHeader) {
    try {
      const routeParams = JSON.parse(routeParamsHeader);
      messageId = routeParams.messageId || messageId;
    } catch (e) {
      // Fall back to path parsing
    }
  }

  if (!messageId) {
    return new Response(JSON.stringify({ error: "Message ID is required" }), {
      status: 400,
      headers: getCorsHeaders(true),
    });
  }

  try {
    const message = await ctx.runQuery(api.messages.getMessageById, {
      messageId: messageId as any,
    });

    if (!message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: getCorsHeaders(true),
      });
    }

    return new Response(JSON.stringify(message), {
      headers: getCorsHeaders(true),
      status: 200,
    });
  } catch (error) {
    console.error("Error getting message:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(true),
    });
  }
});
