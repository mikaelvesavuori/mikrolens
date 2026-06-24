import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["api/tests/**/*.test.ts", "tests/app/**/*.test.ts", "tests/app/**/*.test.js"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["api/src/**/*.ts", "app/**/*.js"],
      exclude: [
        "api/src/server.ts",
        "api/src/webhooks/worker.ts",
        "api/src/openapi/schema.json",
        "app/config.json",
        "app/config.json.example",
        "**/*.d.ts",
      ],
    },
  },
});
