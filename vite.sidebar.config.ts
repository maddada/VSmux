import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    outDir: resolve(__dirname, "out", "sidebar"),
    rollupOptions: {
      input: resolve(__dirname, "sidebar", "index.html"),
      output: {
        assetFileNames: "sidebar[extname]",
        chunkFileNames: "[name].js",
        entryFileNames: "sidebar.js",
      },
    },
  },
});
