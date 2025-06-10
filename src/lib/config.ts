// Development configuration
export const config = {
  apiBaseUrl: import.meta.env.DEV ? "http://localhost:3000" : "", // In production, API is served from same origin
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash-preview-05-20",
    maxTokens: 4096,
    temperature: 0.7,
  },
};
