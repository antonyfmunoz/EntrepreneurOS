import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const root = import.meta.dirname;
const apiOrigin = process.env.EOS_E2E_API_ORIGIN || "http://127.0.0.1:5111";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("pk_test_eos_browser_fixture"),
  },
  resolve: {
    alias: [
      { find: "@clerk/clerk-react", replacement: path.resolve(root, "tests/e2e/clerk-react.mock.tsx") },
      { find: "@", replacement: path.resolve(root, "client/src") },
      { find: "@shared", replacement: path.resolve(root, "shared") },
      { find: "@assets", replacement: path.resolve(root, "attached_assets") },
    ],
  },
  root: path.resolve(root, "client"),
  server: {
    host: "127.0.0.1",
    port: Number(process.env.EOS_E2E_CLIENT_PORT || 5110),
    strictPort: true,
    proxy: { "/api": { target: apiOrigin, changeOrigin: false } },
  },
});
