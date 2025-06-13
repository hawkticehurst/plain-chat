import {
  query,
  mutation,
  httpAction,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// Internal query to get message by ID (no authentication required)
export const getMessageByIdInternal = internalQuery({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    return message;
  },
});

// Public query to get message by ID (requires authentication)
export const getMessageById = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(messageId);

    if (!message) {
      return null;
    }

    // Verify the message belongs to the user
    if (message.userId !== identity.subject) {
      throw new Error("Access denied");
    }

    return message;
  },
});

export const addMessage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get URL parameter from the request URL
  const url = new URL(request.url);
  // Note: The path will be something like /messages, not the full path.
  // We'll handle path params in the router definition.
  // For now, let's assume we get it from the body for simplicity,
  // or see the final http.ts for the real solution.

  // Get the body
  const { chatId, role, content, aiMetadata } = await request.json();

  const messageId = await ctx.runMutation(api.messages.addUserMessage, {
    chatId,
    role,
    content,
    aiMetadata,
  });

  return new Response(JSON.stringify({ messageId }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

// Get messages for a specific chat
export const getChatMessages = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Verify the chat belongs to the user
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== identity.subject || chat.isActive === false) {
      throw new Error("Chat not found or access denied");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_and_created", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Add a message to a chat
export const addUserMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.string(),
    content: v.string(),
    aiMetadata: v.optional(
      v.object({
        model: v.string(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        cost: v.optional(v.number()),
        responseTime: v.optional(v.number()),
        finishReason: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { chatId, role, content, aiMetadata }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Verify the chat belongs to the user
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== identity.subject || chat.isActive === false) {
      throw new Error("Chat not found or access denied");
    }

    const messageId = await ctx.db.insert("messages", {
      chatId,
      userId: identity.subject,
      role,
      content,
      createdAt: Date.now(),
      aiMetadata,
      isAIGenerated: role === "response",
    });

    // Update chat timestamp
    await ctx.db.patch(chatId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Get all messages for a user (backward compatibility)
export const getUserMessages = query({
  args: {
    chatId: v.optional(v.id("chats")),
  },
  handler: async (ctx, { chatId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    if (chatId) {
      // Get messages for specific chat
      const chat = await ctx.db.get(chatId);
      if (
        !chat ||
        chat.userId !== identity.subject ||
        chat.isActive === false
      ) {
        throw new Error("Chat not found or access denied");
      }

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chat_and_created", (q) => q.eq("chatId", chatId))
        .order("asc")
        .collect();

      return messages;
    } else {
      // Get all messages for user (legacy behavior)
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .order("asc")
        .collect();

      return messages;
    }
  },
});

// Create AI response message and schedule streaming
export const createAIMessageWithStreaming = mutation({
  args: {
    chatId: v.id("chats"),
    userMessage: v.string(),
    conversation: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Create placeholder AI message
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: identity.subject,
      role: "response",
      content: "...", // Placeholder content
      createdAt: Date.now(),
      isAIGenerated: true,
      isStreaming: true,
    });

    // Schedule the streaming action
    await ctx.scheduler.runAfter(0, internal.aiStreaming.streamAIResponse, {
      messageId,
      userMessage: args.userMessage,
      chatId: args.chatId,
      conversation: args.conversation,
    });

    return messageId;
  },
});

// HTTP action to get a single message (for polling updates)
export const getMessage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Extract messageId from URL path or headers
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const messageId = pathParts[pathParts.length - 1];

  if (!messageId) {
    return new Response(JSON.stringify({ error: "Message ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const message = await ctx.runQuery(api.messages.getMessageById, {
      messageId: messageId as any,
    });

    if (!message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(message), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
