import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  test: {
    testTimeout: 30_000,
    environment: "node",
    // Dummy env vars so lib/env.ts helpers don't throw during tests that mock
    // the underlying SDK. Tests that need the real value override these.
    env: {
      ANTHROPIC_API_KEY: "test-anthropic-key",
      AI_INTEGRATIONS_ANTHROPIC_API_KEY: "test-anthropic-key",
      AI_INTEGRATIONS_ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      STITCH_API_KEY: "test-stitch-key",
      STITCH_PROJECT_ID: "test-stitch-project",
      DATABASE_URL: "postgresql://test:test@localhost/test",
    },
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "client/src/**/*.test.tsx",
      "client/src/**/*.test.ts",
    ],
  },
});
