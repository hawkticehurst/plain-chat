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
    model: v.optional(v.string()), // Add model parameter
  },
  handler: async (ctx, args) => {
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
                systemPrompt: preferences.systemPrompt,
              }
            : {
                defaultModel: "google/gemini-2.5-flash-preview-05-20",
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
        args.model || // Prioritize the model selected in the UI
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
          temperature: 0.7, // Use default temperature
          maxTokens: 2000, // Use default max tokens
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
