import { query, mutation, httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

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
