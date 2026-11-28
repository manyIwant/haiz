import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const release = JSON.parse(readFileSync(resolve(__dirname, "../release.json"), "utf8"));

// HAIZ Native: the built app lands in native/www, which Capacitor copies into the APK.
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(`${release.versionName}（${release.versionCode}）`) },
  worker: { format: "es" },
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
