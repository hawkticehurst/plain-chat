import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Get recent usage
 * GET /usage/recent
 */
export const getRecentUsage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const usage = await ctx.runQuery(api.usage.getRecentUsage, { limit });

    return new Response(JSON.stringify({ usage }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching recent usage:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch recent usage" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get daily usage summary
 * GET /usage/daily
 */
export const getDailyUsage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "7");

    const summary = await ctx.runQuery(api.usage.getUserUsageSummary, { days });

    return new Response(
      JSON.stringify({ summary: summary?.dailySummaries || [] }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error fetching daily usage:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch daily usage" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get monthly usage summary
 * GET /usage/monthly
 */
export const getMonthlyUsage = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get("months") || "3");
    const days = months * 30; // Approximate conversion

    const summary = await ctx.runQuery(api.usage.getUserUsageSummary, { days });

    // Group daily summaries by month
    const monthlyData: Record<string, any> = {};
    if (summary?.dailySummaries) {
      summary.dailySummaries.forEach((day: any) => {
        const monthKey = day.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            _id: monthKey,
            date: monthKey,
            totalTokens: 0,
            totalCost: 0,
            requestCount: 0,
            modelUsage: {},
          };
        }

        monthlyData[monthKey].totalTokens += day.totalTokens;
        monthlyData[monthKey].totalCost += day.totalCost;
        monthlyData[monthKey].requestCount += day.requestCount;

        // Merge model usage
        Object.entries(day.modelUsage).forEach(([model, tokens]) => {
          if (!monthlyData[monthKey].modelUsage[model]) {
            monthlyData[monthKey].modelUsage[model] = {
              tokens: 0,
              cost: 0,
              requests: 0,
            };
          }
          monthlyData[monthKey].modelUsage[model].tokens += tokens as number;
          // Estimate cost and requests proportionally
          monthlyData[monthKey].modelUsage[model].cost +=
            (day.totalCost * (tokens as number)) / day.totalTokens;
          monthlyData[monthKey].modelUsage[model].requests += Math.ceil(
            (day.requestCount * (tokens as number)) / day.totalTokens
          );
        });
      });
    }

    const monthlySummaries = Object.values(monthlyData);

    return new Response(JSON.stringify({ summary: monthlySummaries }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching monthly usage:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch monthly usage" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
