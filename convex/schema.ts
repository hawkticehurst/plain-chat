import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Chat conversations
  chats: defineTable({
    userId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.optional(v.boolean()), // For soft delete
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  // Messages within chats
  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    role: v.string(), // "prompt" or "response"
    content: v.string(),
    createdAt: v.number(),
    isStreaming: v.optional(v.boolean()), // Indicates if message is currently streaming
    // AI-related fields for messages
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
    isAIGenerated: v.optional(v.boolean()),
  })
    .index("by_chat", ["chatId"])
    .index("by_chat_and_created", ["chatId", "createdAt"])
    .index("by_user", ["userId"])
    .index("by_user_and_ai", ["userId", "isAIGenerated"]),

  // User API keys (encrypted)
  userApiKeys: defineTable({
    userId: v.string(),
    encryptedApiKey: v.string(), // Encrypted OpenRouter API key
    keyHash: v.string(), // Hash for verification without decryption
    isValid: v.boolean(),
    lastValidated: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  // Usage tracking
  usageTracking: defineTable({
    userId: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.number(),
    timestamp: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    requestId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_model", ["model"]),

  // User AI preferences
  userAIPreferences: defineTable({
    userId: v.string(),
    defaultModel: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
    // Usage limits
    dailyUsageLimit: v.optional(v.number()),
    monthlyUsageLimit: v.optional(v.number()),
    // Notification preferences
    usageWarningThreshold: v.optional(v.number()), // Percentage (e.g., 80 for 80%)
    enableUsageNotifications: v.boolean(),
    // Other preferences
    enableStreaming: v.boolean(),
    systemPrompt: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Daily usage summary for quick lookups
  dailyUsageSummary: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    totalTokens: v.number(),
    totalCost: v.number(),
    requestCount: v.number(),
    modelUsage: v.record(v.string(), v.number()), // Dynamic object to track usage per model
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_and_date", ["userId", "date"])
    .index("by_date", ["date"]),

  // Monthly usage summary for quick lookups
  monthlyUsageSummary: defineTable({
    userId: v.string(),
    month: v.string(), // YYYY-MM format
    totalTokens: v.number(),
    totalCost: v.number(),
    requestCount: v.number(),
    modelUsage: v.record(v.string(), v.number()), // Dynamic object to track usage per model
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_and_month", ["userId", "month"])
    .index("by_month", ["month"]),

  // Streaming messages for real-time AI responses
  streamingMessages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    requestId: v.string(), // Unique identifier for this streaming request
    content: v.string(), // Accumulated content so far
    status: v.string(), // "streaming", "completed", "error"
    error: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        cost: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"]),
});
