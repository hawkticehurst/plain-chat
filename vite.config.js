import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./lib/index.ts"),
      "@components": path.resolve(__dirname, "./src/components/index.ts"),
    },
  },
});
