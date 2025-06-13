import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";

// Internal query to get user's API key record (called from actions)
export const getUserApiKeyRecord = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const apiKeyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return apiKeyRecord;
  },
});

// Internal mutation to create new API key record (called from actions)
export const createUserApiKey = internalMutation({
  args: {
    userId: v.string(),
    encryptedApiKey: v.string(),
    keyHash: v.string(),
    isValid: v.boolean(),
    lastValidated: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const keyId = await ctx.db.insert("userApiKeys", {
      userId: args.userId,
      encryptedApiKey: args.encryptedApiKey,
      keyHash: args.keyHash,
      isValid: args.isValid,
      lastValidated: args.lastValidated,
      createdAt: now,
      updatedAt: now,
    });

    return keyId;
  },
});

// Internal mutation to update existing API key record (called from actions)
export const updateUserApiKey = internalMutation({
  args: {
    keyId: v.id("userApiKeys"),
    encryptedApiKey: v.string(),
    keyHash: v.string(),
    isValid: v.boolean(),
    lastValidated: v.number(),
  },
  handler: async (ctx, { keyId, ...updates }) => {
    const now = Date.now();

    await ctx.db.patch(keyId, {
      ...updates,
      updatedAt: now,
    });

    return keyId;
  },
});

// Internal mutation to mark API key as invalid (called from actions)
export const markApiKeyInvalid = internalMutation({
  args: {
    keyId: v.id("userApiKeys"),
  },
  handler: async (ctx, { keyId }) => {
    const now = Date.now();

    await ctx.db.patch(keyId, {
      isValid: false,
      updatedAt: now,
    });

    return keyId;
  },
});

// Public query to check if user has a valid API key (without exposing the key)
export const hasValidApiKey = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const apiKeyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    return !!(apiKeyRecord && apiKeyRecord.isValid);
  },
});

// Public query to get API key status info (without the actual key)
export const getApiKeyStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const apiKeyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!apiKeyRecord) {
      return null;
    }

    return {
      hasKey: true,
      isValid: apiKeyRecord.isValid,
      lastValidated: apiKeyRecord.lastValidated,
      createdAt: apiKeyRecord.createdAt,
      updatedAt: apiKeyRecord.updatedAt,
      keyHash: apiKeyRecord.keyHash, // Safe to expose for display
    };
  },
});

// Public mutation to delete user's API key
export const deleteApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const apiKeyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (apiKeyRecord) {
      await ctx.db.delete(apiKeyRecord._id);
    }

    return { success: true };
  },
});

// Query to get user's AI preferences
export const getUserAIPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const preferences = await ctx.db
      .query("userAIPreferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    return preferences;
  },
});

// Mutation to create or update user's AI preferences
export const setUserAIPreferences = mutation({
  args: {
    defaultModel: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
    dailyUsageLimit: v.optional(v.number()),
    monthlyUsageLimit: v.optional(v.number()),
    usageWarningThreshold: v.optional(v.number()),
    enableUsageNotifications: v.boolean(),
    enableStreaming: v.optional(v.boolean()), // Make optional for backward compatibility
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const existingPreferences = await ctx.db
      .query("userAIPreferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    const now = Date.now();

    // Provide default value for enableStreaming if not provided
    const enableStreaming = args.enableStreaming ?? true; // Default to true for Convex streaming

    if (existingPreferences) {
      // Update existing preferences
      await ctx.db.patch(existingPreferences._id, {
        ...args,
        enableStreaming,
        updatedAt: now,
      });
      return existingPreferences._id;
    } else {
      // Create new preferences
      const preferencesId = await ctx.db.insert("userAIPreferences", {
        userId: identity.subject,
        ...args,
        enableStreaming,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }
  },
});

// Query to get user's usage tracking data
export const getUserUsageTracking = query({
  args: {
    limit: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50, startTime, endTime }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    let query = ctx.db
      .query("usageTracking")
      .withIndex("by_user_and_timestamp", (q) => {
        if (startTime && endTime) {
          return q
            .eq("userId", identity.subject)
            .gte("timestamp", startTime)
            .lte("timestamp", endTime);
        } else if (startTime) {
          return q.eq("userId", identity.subject).gte("timestamp", startTime);
        } else if (endTime) {
          return q.eq("userId", identity.subject).lte("timestamp", endTime);
        } else {
          return q.eq("userId", identity.subject);
        }
      })
      .order("desc");

    if (limit) {
      return await query.take(limit);
    }

    return await query.collect();
  },
});

// Mutation to record usage tracking
export const recordUsage = mutation({
  args: {
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const usageId = await ctx.db.insert("usageTracking", {
      userId: identity.subject,
      timestamp: Date.now(),
      ...args,
    });

    // Update daily summary
    await updateDailyUsageSummary(ctx, identity.subject, args);

    // Update monthly summary
    await updateMonthlyUsageSummary(ctx, identity.subject, args);

    return usageId;
  },
});

// Helper function to update daily usage summary
async function updateDailyUsageSummary(
  ctx: any,
  userId: string,
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    success: boolean;
  }
) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const existingSummary = await ctx.db
    .query("dailyUsageSummary")
    .withIndex("by_user_and_date", (q) =>
      q.eq("userId", userId).eq("date", today)
    )
    .first();

  const now = Date.now();

  if (existingSummary) {
    // Update existing summary
    const currentModelUsage = existingSummary.modelUsage || {};
    const modelKey = usage.model;
    const currentModelData = currentModelUsage[modelKey] || {
      tokens: 0,
      cost: 0,
      requests: 0,
    };

    await ctx.db.patch(existingSummary._id, {
      totalTokens: existingSummary.totalTokens + usage.totalTokens,
      totalCost: existingSummary.totalCost + usage.cost,
      requestCount: existingSummary.requestCount + 1,
      modelUsage: {
        ...currentModelUsage,
        [modelKey]: {
          tokens: currentModelData.tokens + usage.totalTokens,
          cost: currentModelData.cost + usage.cost,
          requests: currentModelData.requests + 1,
        },
      },
      updatedAt: now,
    });
  } else {
    // Create new summary
    await ctx.db.insert("dailyUsageSummary", {
      userId,
      date: today,
      totalTokens: usage.totalTokens,
      totalCost: usage.cost,
      requestCount: 1,
      modelUsage: {
        [usage.model]: {
          tokens: usage.totalTokens,
          cost: usage.cost,
          requests: 1,
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}

// Helper function to update monthly usage summary
async function updateMonthlyUsageSummary(
  ctx: any,
  userId: string,
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    success: boolean;
  }
) {
  const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  const existingSummary = await ctx.db
    .query("monthlyUsageSummary")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("month", thisMonth)
    )
    .first();

  const now = Date.now();

  if (existingSummary) {
    // Update existing summary
    const currentModelUsage = existingSummary.modelUsage || {};
    const modelKey = usage.model;
    const currentModelData = currentModelUsage[modelKey] || {
      tokens: 0,
      cost: 0,
      requests: 0,
    };

    await ctx.db.patch(existingSummary._id, {
      totalTokens: existingSummary.totalTokens + usage.totalTokens,
      totalCost: existingSummary.totalCost + usage.cost,
      requestCount: existingSummary.requestCount + 1,
      modelUsage: {
        ...currentModelUsage,
        [modelKey]: {
          tokens: currentModelData.tokens + usage.totalTokens,
          cost: currentModelData.cost + usage.cost,
          requests: currentModelData.requests + 1,
        },
      },
      updatedAt: now,
    });
  } else {
    // Create new summary
    await ctx.db.insert("monthlyUsageSummary", {
      userId,
      month: thisMonth,
      totalTokens: usage.totalTokens,
      totalCost: usage.cost,
      requestCount: 1,
      modelUsage: {
        [usage.model]: {
          tokens: usage.totalTokens,
          cost: usage.cost,
          requests: 1,
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}

// Query to get daily usage summary
export const getDailyUsageSummary = query({
  args: {
    days: v.optional(v.number()), // Number of days to fetch (default 30)
  },
  handler: async (ctx, { days = 30 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    return await ctx.db
      .query("dailyUsageSummary")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", identity.subject).gte("date", startDateStr)
      )
      .order("desc")
      .collect();
  },
});

// Query to get monthly usage summary
export const getMonthlyUsageSummary = query({
  args: {
    months: v.optional(v.number()), // Number of months to fetch (default 12)
  },
  handler: async (ctx, { months = 12 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Calculate start month
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startMonthStr = startDate.toISOString().substring(0, 7);

    return await ctx.db
      .query("monthlyUsageSummary")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", identity.subject).gte("month", startMonthStr)
      )
      .order("desc")
      .collect();
  },
});

// Get user AI preferences by userId (for internal use)
export const getUserAIPreferencesById = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const userPrefs = await ctx.db
      .query("userAIPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return userPrefs;
  },
});
