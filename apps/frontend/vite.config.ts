import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envDir: path.resolve(__dirname, "../.."),
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    watch: {
      ignored: ["**/node_modules/**", "**/.git/**", "**/.turbo/**", "**/dist/**"],
      usePolling: true,
      interval: 500,
    },
  },
});
