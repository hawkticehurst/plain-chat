// Usage tracking functions for AI operations
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Record AI usage
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

    const now = Date.now();

    // Record individual usage
    await ctx.db.insert("usageTracking", {
      userId: identity.subject,
      timestamp: now,
      ...args,
    });

    // Update daily summary
    const today = new Date(now).toISOString().split("T")[0]; // YYYY-MM-DD
    const dailySummary = await ctx.db
      .query("dailyUsageSummary")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today)
      )
      .first();

    if (dailySummary) {
      // Update existing summary
      const modelUsage = dailySummary.modelUsage as Record<string, any>;
      modelUsage[args.model] = (modelUsage[args.model] || 0) + args.totalTokens;

      await ctx.db.patch(dailySummary._id, {
        totalTokens: dailySummary.totalTokens + args.totalTokens,
        totalCost: dailySummary.totalCost + args.cost,
        requestCount: dailySummary.requestCount + 1,
        modelUsage,
        updatedAt: now,
      });
    } else {
      // Create new daily summary
      await ctx.db.insert("dailyUsageSummary", {
        userId: identity.subject,
        date: today,
        totalTokens: args.totalTokens,
        totalCost: args.cost,
        requestCount: 1,
        modelUsage: { [args.model]: args.totalTokens },
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Get user's usage summary
export const getUserUsageSummary = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = 7 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get daily summaries for the period
    const dailySummaries = await ctx.db
      .query("dailyUsageSummary")
      .withIndex("by_user_and_date", (q) => q.eq("userId", identity.subject))
      .filter(
        (q) =>
          q.gte(q.field("date"), startDateStr) &&
          q.lte(q.field("date"), endDateStr)
      )
      .collect();

    // Calculate totals
    const totalTokens = dailySummaries.reduce(
      (sum, day) => sum + day.totalTokens,
      0
    );
    const totalCost = dailySummaries.reduce(
      (sum, day) => sum + day.totalCost,
      0
    );
    const totalRequests = dailySummaries.reduce(
      (sum, day) => sum + day.requestCount,
      0
    );

    return {
      period: { days, startDate: startDateStr, endDate: endDateStr },
      totalTokens,
      totalCost,
      totalRequests,
      dailySummaries,
    };
  },
});

// Get recent usage records
export const getRecentUsage = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("usageTracking")
      .withIndex("by_user_and_timestamp", (q) =>
        q.eq("userId", identity.subject)
      )
      .order("desc")
      .take(limit);
  },
});
