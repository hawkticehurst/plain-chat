import { httpAction } from "../_generated/server";

// CORS headers for cross-origin requests
const getCorsHeaders = (isDev = false) => {
  const allowedOrigins = isDev
    ? [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
      ]
    : ["https://your-production-domain.com"]; // Replace with your actual production domain

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": isDev ? "*" : allowedOrigins[0], // More restrictive in prod
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
};

/**
 * Auth status endpoint
 * GET /auth/status
 */
export const getAuthStatus = httpAction(async (ctx, request) => {
  // Check if we're in development (you can also use environment variables)
  const isDev = process.env.NODE_ENV !== "production";

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
