// Configuration for API endpoints
export const config = {
  apiBaseUrl: import.meta.env.VITE_CONVEX_HTTP_URL || "",
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash-preview-05-20",
  },
};
