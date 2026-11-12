import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const config = {
  plugins: [react()],
  build: { outDir: "demo-dist" },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
} as UserConfig;

export default defineConfig(config);
