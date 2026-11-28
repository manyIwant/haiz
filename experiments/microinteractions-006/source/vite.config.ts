import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The built site lands one folder up (experiments/microinteractions-006/), so the folder
// itself is the static preview and the Vite project lives beside it in source/.
// postbuild.mjs clears stale hashed assets before each build writes new ones.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, ".."),
    emptyOutDir: false,
    assetsDir: "assets",
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        bench: resolve(__dirname, "bench.html"),
      },
    },
  },
  server: { fs: { strict: false } },
});
