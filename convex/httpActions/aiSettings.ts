import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Check if user has valid API key
 * GET /ai/has-valid-key
 */
export const hasValidKey = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const hasKey = await ctx.runQuery(api.aiKeys.hasValidApiKey);
    return new Response(JSON.stringify({ hasValidKey: hasKey }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error checking API key:", error);
    return new Response(JSON.stringify({ error: "Failed to check API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Get API key status
 * GET /ai/key-status
 */
export const getKeyStatus = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const keyStatus = await ctx.runQuery(api.aiKeys.getApiKeyStatus);
    return new Response(JSON.stringify(keyStatus), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching key status:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch key status" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get AI preferences
 * GET /ai/preferences
 */
export const getPreferences = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const preferences = await ctx.runQuery(api.aiKeys.getUserAIPreferences);

    // Handle model name migration from old to new
    if (
      preferences &&
      preferences.defaultModel === "google/gemini-2.0-flash-exp"
    ) {
      preferences.defaultModel = "google/gemini-2.5-flash-preview-05-20";
    }

    const response = preferences || {
      defaultModel: "google/gemini-2.5-flash-preview-05-20",
      temperature: 0.7,
      maxTokens: 2000,
      enableStreaming: true,
      systemPrompt: "",
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch preferences" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Set AI preferences
 * POST /ai/preferences
 */
export const setPreferences = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    await ctx.runMutation(api.aiKeys.setUserAIPreferences, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error saving preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to save preferences" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Test API key
 * POST /ai/test-key
 */
export const testKey = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { apiKey } = await request.json();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ valid: false, error: "API key required" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const result = await ctx.runAction(api.cryptoActions.testApiKey, {
      apiKey,
    });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error testing API key:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Failed to test API key" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

/**
 * Set API key
 * POST /ai/set-key
 */
export const setKey = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { apiKey } = await request.json();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runAction(api.cryptoActions.setUserApiKey, { apiKey });
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error setting API key:", error);
    return new Response(JSON.stringify({ error: "Failed to set API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
