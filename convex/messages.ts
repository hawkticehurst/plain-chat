import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
export const addMessage = mutation({
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
