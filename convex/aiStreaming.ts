import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Action to handle streaming AI response (runs in background)
export const streamAIResponse = internalAction({
  args: {
    messageId: v.id("messages"),
    userMessage: v.string(),
    chatId: v.id("chats"),
    conversation: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(`[AI Streaming] Starting stream for message ${args.messageId}`);

    try {
      // Get user's AI preferences
      const message = await ctx.runQuery(
        internal.messages.getMessageByIdInternal,
        {
          messageId: args.messageId,
        }
      );

      if (!message) {
        throw new Error("Message not found");
      }

      // Get user preferences
      const preferences = await ctx.runQuery(
        api.aiKeys.getUserAIPreferencesById,
        {
          userId: message.userId,
        }
      );

      // Call internal AI completion action with security safeguards
      const authResult = await ctx.runAction(
        internal.cryptoActions.performStreamingAICompletionInternal,
        {
          userId: message.userId,
          messageId: args.messageId,
          message: args.userMessage,
          conversation: args.conversation.slice(-10),
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

      if (!authResult.success) {
        await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
          messageId: args.messageId,
          error: authResult.error,
        });
        return;
      }

      console.log(
        `[AI Streaming] Auth successful, calling Node.js action for message ${args.messageId}`
      );

      // Get the API key record
      const apiKeyRecord = await ctx.runQuery(
        internal.aiKeys.getUserApiKeyRecord,
        {
          userId: message.userId,
        }
      );

      if (!apiKeyRecord) {
        await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
          messageId: args.messageId,
          error: "No API key found",
        });
        return;
      }

      // Prepare messages for AI API
      const messages: Array<{ role: string; content: string }> = [];

      // Add system prompt if provided
      const systemPrompt = preferences?.systemPrompt;
      if (systemPrompt && systemPrompt.trim()) {
        messages.push({
          role: "system",
          content: systemPrompt.trim(),
        });
      }

      // Add conversation history
      for (const msg of args.conversation) {
        messages.push({
          role: msg.role === "prompt" ? "user" : "assistant",
          content: msg.content,
        });
      }

      // Add current user message
      messages.push({
        role: "user",
        content: args.userMessage,
      });

      const modelToUse =
        authResult.model ||
        preferences?.defaultModel ||
        "google/gemini-2.5-flash-preview-05-20";

      // Call the Node.js action to handle the streaming
      const result = await ctx.runAction(
        internal.aiStreamingNode.performStreamingWithNode,
        {
          messageId: args.messageId,
          apiKeyRecord: {
            _id: apiKeyRecord._id,
            encryptedApiKey: apiKeyRecord.encryptedApiKey,
          },
          messages,
          model: modelToUse,
          temperature: preferences?.temperature || 0.7,
          maxTokens: preferences?.maxTokens || 2000,
        }
      );

      if (!result.success) {
        console.error(`[AI Streaming] Node.js action failed: ${result.error}`);
        return;
      }

      // Record usage
      if (result.usage) {
        try {
          await ctx.runMutation(api.usage.recordUsage, {
            model: result.usage.model,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            cost: result.usage.cost,
            success: true,
            requestId: args.messageId, // Use messageId as requestId for simplicity
          });
        } catch (usageError) {
          console.error("Error recording usage:", usageError);
        }
      }

      console.log(
        `[AI Streaming] Completed stream for message ${args.messageId}`
      );
    } catch (error) {
      console.error(
        `[AI Streaming] Error for message ${args.messageId}:`,
        error
      );

      await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
        messageId: args.messageId,
        error: error.message || "Streaming failed",
      });
    }
  },
});

// Update message content during streaming
export const updateMessageContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      // Add streaming indicator
      isStreaming: true,
    });
  },
});

// Complete the message
export const completeMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    finalContent: v.string(),
    usage: v.object({
      model: v.string(),
      promptTokens: v.number(),
      completionTokens: v.number(),
      totalTokens: v.number(),
      cost: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.finalContent,
      isStreaming: false,
      aiMetadata: {
        model: args.usage.model,
        promptTokens: args.usage.promptTokens,
        completionTokens: args.usage.completionTokens,
        totalTokens: args.usage.totalTokens,
        cost: args.usage.cost,
        responseTime: Date.now(),
      },
    });
  },
});

// Handle streaming errors
export const updateMessageWithError = internalMutation({
  args: {
    messageId: v.id("messages"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: `❌ Streaming error: ${args.error}`,
      isStreaming: false,
    });
  },
});

// Test functions for debugging (no authentication required)
export const createTestStreamingMessage = internalMutation({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[Test] Creating test streaming message:", args.content);

    // First create a test chat if it doesn't exist
    let testChatId;

    // Try to find existing test chat
    const existingChat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("userId"), "test-user"))
      .filter((q) => q.eq(q.field("title"), "Test Chat"))
      .first();

    if (existingChat) {
      testChatId = existingChat._id;
      console.log("[Test] Using existing test chat:", testChatId);
    } else {
      // Create a new test chat
      testChatId = await ctx.db.insert("chats", {
        userId: "test-user",
        title: "Test Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      });
      console.log("[Test] Created new test chat:", testChatId);
    }

    const messageId = await ctx.db.insert("messages", {
      chatId: testChatId,
      userId: "test-user", // Test user ID
      role: "response",
      content: "...", // Placeholder content
      createdAt: Date.now(),
      isAIGenerated: true,
      isStreaming: true,
    });

    console.log("[Test] Created test message with ID:", messageId);
    return messageId;
  },
});

// Test function that creates a message and schedules streaming (with proper scheduler access)
export const createTestStreamingMessageWithScheduling = internalMutation({
  args: {
    content: v.string(),
    userMessage: v.string(),
    conversation: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(
      "[Test] Creating test streaming message with scheduling:",
      args.content
    );

    // First create a test chat if it doesn't exist
    let testChatId;

    // Try to find existing test chat
    const existingChat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("userId"), "test-user"))
      .filter((q) => q.eq(q.field("title"), "Test Chat"))
      .first();

    if (existingChat) {
      testChatId = existingChat._id;
      console.log("[Test] Using existing test chat:", testChatId);
    } else {
      // Create a new test chat
      testChatId = await ctx.db.insert("chats", {
        userId: "test-user",
        title: "Test Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      });
      console.log("[Test] Created new test chat:", testChatId);
    }

    const messageId = await ctx.db.insert("messages", {
      chatId: testChatId,
      userId: "test-user",
      role: "response",
      content: "...", // Placeholder content
      createdAt: Date.now(),
      isAIGenerated: true,
      isStreaming: true,
    });

    console.log("[Test] Created test message with ID:", messageId);

    // Schedule the streaming action (this works from a mutation context)
    await ctx.scheduler.runAfter(0, internal.aiStreaming.streamAIResponse, {
      messageId,
      userMessage: args.userMessage,
      chatId: testChatId,
      conversation: args.conversation,
    });

    console.log("[Test] Scheduled streaming action for message:", messageId);

    return messageId;
  },
});

export const getTestMessage = internalQuery({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    console.log("[Test] Querying test message:", args.messageId);
    const message = await ctx.db.get(args.messageId);

    if (!message) {
      console.log("[Test] Message not found:", args.messageId);
      return null;
    }

    console.log("[Test] Found message:", message);
    return {
      id: message._id,
      chatId: message.chatId,
      content: message.content,
      isStreaming: message.isStreaming,
      role: message.role,
      createdAt: message.createdAt,
    };
  },
});
