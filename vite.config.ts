import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Tauri erwartet den Dev-Server auf localhost:1420 (siehe tauri.conf.json)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Release-Build: keine Source-Maps (würden im Installer landen),
  // aufgeteilte Vendor-Chunks für schnelleren Start.
  build: {
    target: "chrome110", // WebView2 auf Windows 10/11
    sourcemap: false,
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          // @tiptap/pm bewusst NICHT hier: Das Paket hat keinen Root-Export,
          // nur Unterpfade (/state, /view). Als manualChunk-Eintrag scheitert
          // die Auflösung mit 'Missing "." specifier'.
          tiptap: ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/core"],
          export: ["docx", "pdf-lib", "jszip"],
          sqlite: ["sql.js"],
        },
      },
    },
  },
});
