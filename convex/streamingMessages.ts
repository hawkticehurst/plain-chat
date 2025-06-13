import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to watch streaming message updates in real-time
export const watchStreamingMessage = query({
  args: { requestId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const streamingMessage = await ctx.db
      .query("streamingMessages")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    return streamingMessage;
  },
});

// Create a new streaming message
export const createStreamingMessage = mutation({
  args: {
    chatId: v.id("chats"),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const streamingMessageId = await ctx.db.insert("streamingMessages", {
      chatId: args.chatId,
      userId: identity.subject,
      requestId: args.requestId,
      content: "",
      status: "streaming",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return streamingMessageId;
  },
});

// Update streaming message content (called incrementally during streaming)
export const updateStreamingContent = mutation({
  args: {
    requestId: v.string(),
    content: v.string(),
    append: v.optional(v.boolean()), // If true, append to existing content
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingMessage = await ctx.db
      .query("streamingMessages")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!existingMessage) {
      throw new Error("Streaming message not found");
    }

    const newContent = args.append
      ? existingMessage.content + args.content
      : args.content;

    await ctx.db.patch(existingMessage._id, {
      content: newContent,
      updatedAt: Date.now(),
    });

    return newContent;
  },
});

// Complete streaming message (move from streaming to final message)
export const completeStreamingMessage = mutation({
  args: {
    requestId: v.string(),
    finalContent: v.string(),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        cost: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const streamingMessage = await ctx.db
      .query("streamingMessages")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!streamingMessage) {
      throw new Error("Streaming message not found");
    }

    // Update streaming message to completed status
    await ctx.db.patch(streamingMessage._id, {
      content: args.finalContent,
      status: "completed",
      usage: args.usage,
      updatedAt: Date.now(),
    });

    // Create the final message in the messages table
    await ctx.db.insert("messages", {
      chatId: streamingMessage.chatId,
      userId: identity.subject,
      role: "response",
      content: args.finalContent,
      createdAt: Date.now(),
      isAIGenerated: true,
      aiMetadata: args.usage
        ? {
            model: "streaming", // We'll update this with actual model
            promptTokens: args.usage.promptTokens,
            completionTokens: args.usage.completionTokens,
            totalTokens: args.usage.totalTokens,
            cost: args.usage.cost,
            responseTime: Date.now() - streamingMessage.createdAt,
          }
        : undefined,
    });

    return streamingMessage._id;
  },
});

// Handle streaming error
export const errorStreamingMessage = mutation({
  args: {
    requestId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const streamingMessage = await ctx.db
      .query("streamingMessages")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!streamingMessage) {
      throw new Error("Streaming message not found");
    }

    await ctx.db.patch(streamingMessage._id, {
      status: "error",
      error: args.error,
      updatedAt: Date.now(),
    });

    return streamingMessage._id;
  },
});

// Clean up old streaming messages (can be called periodically)
export const cleanupStreamingMessages = mutation({
  args: { olderThanHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const cutoffTime =
      Date.now() - (args.olderThanHours || 24) * 60 * 60 * 1000;

    const oldStreamingMessages = await ctx.db
      .query("streamingMessages")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.lt(q.field("createdAt"), cutoffTime))
      .collect();

    for (const message of oldStreamingMessages) {
      await ctx.db.delete(message._id);
    }

    return oldStreamingMessages.length;
  },
});
