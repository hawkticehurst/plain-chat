// Development configuration
export const config = {
  apiBaseUrl: import.meta.env.DEV ? "http://localhost:3000" : "", // In production, API is served from same origin
};
