import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { getCorsHeaders, isDevelopment } from "../lib/corsConfig";

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
  // URL pattern: .../chats/:chatId/... or .../chats/:chatId
  const chatsIndex = pathParts.findIndex((part) => part === "chats");
  if (chatsIndex !== -1 && pathParts[chatsIndex + 1]) {
    return pathParts[chatsIndex + 1];
  }
  throw new Error("Chat ID not found in URL or route parameters");
}

/**
 * Get all chats for user
 * GET /chats
 */
export const getChats = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

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

    const chats = await ctx.runQuery(api.chats.getUserChats);
    return new Response(JSON.stringify({ chats }), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ Error in getChats:", error.message || error);

    // Handle JWT/auth errors as unauthorized
    if (
      error.message &&
      (error.message.includes("JWT") || error.message.includes("audience"))
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: getCorsHeaders(isDev),
      });
    }

    // Handle other errors as server errors
    return new Response(JSON.stringify({ error: "Failed to fetch chats" }), {
      status: 500,
      headers: getCorsHeaders(isDev),
    });
  }
});

/**
 * Create new chat
 * POST /chats
 */
export const createChat = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { title } = await request.json();
    const chatId = await ctx.runMutation(api.chats.createChat, {
      title: title || "New Conversation",
    });
    return new Response(JSON.stringify({ chatId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating chat:", error);
    return new Response(JSON.stringify({ error: "Failed to create chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Update chat title
 * PATCH /chats/:chatId/title
 */
export const updateChatTitle = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const chatId = extractChatId(request);
    const { title } = await request.json();

    await ctx.runMutation(api.chats.updateChatTitle, {
      chatId: chatId as any,
      title,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error updating chat title:", error);
    return new Response(JSON.stringify({ error: "Failed to update title" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Generate chat title using AI
 * POST /chats/:chatId/generate-title
 */
export const generateChatTitle = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const chatId = extractChatId(request);
    const { firstMessage } = await request.json();

    // Generate title using AI
    const result = await ctx.runAction(api.cryptoActions.generateChatTitle, {
      firstMessage,
    });

    if (result.success) {
      // Update the chat title
      await ctx.runMutation(api.chats.updateChatTitle, {
        chatId: chatId as any,
        title: result.title,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error generating chat title:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate title",
        title: "New Conversation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Delete chat
 * DELETE /chats/:chatId
 */
export const deleteChat = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const chatId = extractChatId(request);

    await ctx.runMutation(api.chats.deleteChat, {
      chatId: chatId as any,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error deleting chat:", error);
    return new Response(JSON.stringify({ error: "Failed to delete chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
