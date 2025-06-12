// Configuration for API endpoints
export const config = {
  // Use dedicated HTTP URL that won't be overwritten by Convex CLI
  apiBaseUrl: import.meta.env.VITE_CONVEX_HTTP_URL
    ? import.meta.env.VITE_CONVEX_HTTP_URL // Use dedicated HTTP URL
    : import.meta.env.VITE_CONVEX_URL?.replace(".convex.cloud", ".convex.site") // Fallback with URL fix
      ? import.meta.env.VITE_CONVEX_URL.replace(".convex.cloud", ".convex.site")
      : import.meta.env.DEV
        ? "http://localhost:3000" // Legacy fallback for development
        : "", // Production fallback
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash-preview-05-20",
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// Debug logging in development
if (import.meta.env.DEV) {
  console.log("🔧 Config Debug:", {
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    apiBaseUrl: config.apiBaseUrl,
    isDev: import.meta.env.DEV,
  });
}
