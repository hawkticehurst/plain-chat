// convex/lib/corsConfig.ts
// Centralized CORS configuration for all HTTP actions

export const CORS_CONFIG = {
  developmentOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],

  productionOrigins: ["https://plain-chat.pages.dev"],

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  headers: ["Content-Type", "Authorization"],
};

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(isDev = false): string[] {
  const origins = isDev
    ? CORS_CONFIG.developmentOrigins
    : [...CORS_CONFIG.productionOrigins];

  // Add custom domain if configured in production
  if (!isDev && process.env.VITE_PRODUCTION_DOMAIN) {
    origins.push(process.env.VITE_PRODUCTION_DOMAIN);
  }

  return origins;
}

/**
 * Get CORS headers for HTTP responses
 */
export function getCorsHeaders(isDev = false): HeadersInit {
  const allowedOrigins = getAllowedOrigins(isDev);

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": isDev
      ? "*"
      : allowedOrigins[0] || "https://plain-chat.pages.dev",
    "Access-Control-Allow-Methods": CORS_CONFIG.methods.join(", "),
    "Access-Control-Allow-Headers": CORS_CONFIG.headers.join(", "),
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Get CORS headers for streaming responses
 */
export function getStreamingCorsHeaders(isDev = false): HeadersInit {
  const allowedOrigins = getAllowedOrigins(isDev);

  return {
    "Access-Control-Allow-Origin": isDev
      ? "*"
      : allowedOrigins[0] || "https://plain-chat.pages.dev",
    "Access-Control-Allow-Methods": CORS_CONFIG.methods.join(", "),
    "Access-Control-Allow-Headers": CORS_CONFIG.headers.join(", "),
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Allow-Credentials": isDev ? "false" : "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Check if the current environment is development
 */
export function isDevelopment(): boolean {
  // Check multiple indicators for development environment
  // 1. NODE_ENV is not production
  // 2. CONVEX_DEPLOYMENT contains 'dev:'
  // 3. No specific production environment variable is set

  const nodeEnv = process.env.NODE_ENV;
  const convexDeployment = process.env.CONVEX_DEPLOYMENT;

  // If NODE_ENV is explicitly set to production, it's production
  if (nodeEnv === "production") {
    return false;
  }

  // If CONVEX_DEPLOYMENT starts with 'dev:', it's development
  if (convexDeployment && convexDeployment.startsWith("dev:")) {
    return true;
  }

  // If CONVEX_DEPLOYMENT starts with 'prod:', it's production
  if (convexDeployment && convexDeployment.startsWith("prod:")) {
    return false;
  }

  // Default to development if uncertain
  return true;
}
