import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { getCorsHeaders, isDevelopment } from "../lib/corsConfig";

/**
 * Check if user has valid API key
 * GET /ai/has-valid-key
 */
export const hasValidKey = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const hasKey = await ctx.runQuery(api.aiKeys.hasValidApiKey);
    return new Response(JSON.stringify({ hasValidKey: hasKey }), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error checking API key:", error);
    return new Response(JSON.stringify({ error: "Failed to check API key" }), {
      status: 500,
      headers: getCorsHeaders(isDev),
    });
  }
});

/**
 * Get API key status
 * GET /ai/key-status
 */
export const getKeyStatus = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const keyStatus = await ctx.runQuery(api.aiKeys.getApiKeyStatus);
    return new Response(JSON.stringify(keyStatus), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching key status:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch key status" }),
      {
        status: 500,
        headers: getCorsHeaders(isDev),
      }
    );
  }
});

/**
 * Get AI preferences
 * GET /ai/preferences
 */
export const getPreferences = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const preferences = await ctx.runQuery(api.aiKeys.getUserAIPreferences);

    const response = preferences || {
      defaultModel: "google/gemini-2.5-flash-preview-05-20",
      enableStreaming: true,
      systemPrompt: "",
    };

    return new Response(JSON.stringify(response), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch preferences" }),
      {
        status: 500,
        headers: getCorsHeaders(isDev),
      }
    );
  }
});

/**
 * Set AI preferences
 * POST /ai/preferences
 */
export const setPreferences = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const body = await request.json();
    await ctx.runMutation(api.aiKeys.setUserAIPreferences, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error saving preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to save preferences" }),
      {
        status: 500,
        headers: getCorsHeaders(isDev),
      }
    );
  }
});

/**
 * Test API key
 * POST /ai/test-key
 */
export const testKey = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const { apiKey } = await request.json();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ valid: false, error: "API key required" }),
        {
          headers: getCorsHeaders(isDev),
          status: 200,
        }
      );
    }

    const result = await ctx.runAction(api.cryptoActions.testApiKey, {
      apiKey,
    });
    return new Response(JSON.stringify(result), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error testing API key:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Failed to test API key" }),
      {
        headers: getCorsHeaders(isDev),
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
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: getCorsHeaders(isDev),
    });
  }

  try {
    const { apiKey } = await request.json();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 400,
        headers: getCorsHeaders(isDev),
      });
    }

    await ctx.runAction(api.cryptoActions.setUserApiKey, { apiKey });
    return new Response(JSON.stringify({ success: true }), {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  } catch (error: any) {
    console.error("Error setting API key:", error);
    return new Response(JSON.stringify({ error: "Failed to set API key" }), {
      status: 500,
      headers: getCorsHeaders(isDev),
    });
  }
});
