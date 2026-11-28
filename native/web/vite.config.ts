import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// HAIZ Native: the built app lands in native/www, which Capacitor copies into the APK.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "../www"),
    emptyOutDir: true,
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
