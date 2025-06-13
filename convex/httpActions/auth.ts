import { httpAction } from "../_generated/server";
import { getCorsHeaders, isDevelopment } from "../lib/corsConfig";

/**
 * Auth status endpoint
 * GET /auth/status
 */
export const getAuthStatus = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(isDev),
      status: 200,
    });
  }

  try {
    const identity = await ctx.auth.getUserIdentity();

    return new Response(
      JSON.stringify({
        isAuthenticated: !!identity,
        userId: identity?.subject || null,
      }),
      {
        headers: getCorsHeaders(isDev),
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Auth error:", error.message || error);
    return new Response(
      JSON.stringify({
        isAuthenticated: false,
        userId: null,
        error: error.message,
      }),
      {
        headers: getCorsHeaders(isDev),
        status: 200, // Return 200 but with auth false
      }
    );
  }
});
