import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all chats for a user
export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("isActive"), false))
      .order("desc")
      .collect();

    return chats;
  },
});

// Create a new chat
export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, { title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const now = Date.now();
    const chatId = await ctx.db.insert("chats", {
      userId: identity.subject,
      title: title || "New Conversation",
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    return chatId;
  },
});

// Update chat title
export const updateChatTitle = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.string(),
  },
  handler: async (ctx, { chatId, title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Verify the chat belongs to the user
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(chatId, {
      title,
      updatedAt: Date.now(),
    });

    return chatId;
  },
});

// Update chat timestamp (when new message is added)
export const updateChatTimestamp = mutation({
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
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(chatId, {
      updatedAt: Date.now(),
    });

    return chatId;
  },
});

// Delete a chat (soft delete)
export const deleteChat = mutation({
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
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(chatId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return chatId;
  },
});

// Get a single chat
export const getChat = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== identity.subject || chat.isActive === false) {
      return null;
    }

    return chat;
  },
});
