import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "dist/**"],
    testTimeout: 30000,
    // These suites operate on real, shared seeded database rows rather than per-test
    // transactional isolation (matching the existing rollback-transaction tests in
    // ledger.test.ts, which don't need this). Running test FILES in parallel lets two
    // files race on the same seeded seller/variant and intermittently fail. Force
    // sequential execution until proper per-test DB isolation exists.
    fileParallelism: false,
    server: {
      deps: {
        // next-auth ships as native ESM and internally does `import ... from "next/server"`
        // with no file extension. next's package.json has no "exports" map, so Node's native
        // ESM resolver (used for externalized node_modules deps) can't apply the extension
        // inference that CommonJS require() and bundler-style resolvers (webpack/Turbopack,
        // and Vite's own resolver) both do — it fails with ERR_MODULE_NOT_FOUND. Inlining
        // next-auth routes it through Vite's resolver instead of raw Node ESM resolution.
        inline: [/next-auth/],
      },
    },
  },
  resolve: {
    alias: {
      // Server Actions call revalidatePath()/revalidateTag() as a side effect after their
      // real work completes. Those require an active Next.js request context (a "static
      // generation store") that doesn't exist when a test calls an action directly, so they
      // throw "Invariant: static generation store missing" — masking otherwise-successful
      // actions as failures. Reuses the same no-op mock already used by the ts-node script
      // test harness (scripts/mock-next-cache.ts, wired via tsconfig.test.json).
      "next/cache": path.resolve(__dirname, "./scripts/mock-next-cache.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
