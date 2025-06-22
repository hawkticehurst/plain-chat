// Debug utility to check environment variables
// This can be imported temporarily to debug environment variable issues

export function logEnvironmentVariables() {
  console.group("Environment Variables Debug");

  const envVars = {
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_CONVEX_HTTP_URL: import.meta.env.VITE_CONVEX_HTTP_URL,
    VITE_BETA_DOMAIN: import.meta.env.VITE_BETA_DOMAIN,
    VITE_PRODUCTION_DOMAIN: import.meta.env.VITE_PRODUCTION_DOMAIN,
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    console.log(
      `${key}:`,
      value
        ? key.includes("KEY")
          ? `${value.substring(0, 10)}...`
          : value
        : "❌ NOT SET"
    );
  });

  console.groupEnd();
}

// Auto-run in development
if (import.meta.env.DEV) {
  logEnvironmentVariables();
}
