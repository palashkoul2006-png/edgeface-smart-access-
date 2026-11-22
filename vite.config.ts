// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // recharts imports this as a named ESM export but the package only ships CJS.
        // Point to our local ESM shim that re-implements it using React 19's useSyncExternalStore.
        "use-sync-external-store/shim/with-selector": "/src/shims/use-sync-external-store-shim.js",
        "use-sync-external-store/shim/with-selector.js": "/src/shims/use-sync-external-store-shim.js",
      },
    },
    optimizeDeps: {
      include: ["recharts"],
      exclude: ["use-sync-external-store"],
    },
  },
});
