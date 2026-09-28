import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// Tauri erwartet den Dev-Server auf localhost:1420 (siehe tauri.conf.json)
export default defineConfig({
  plugins: [
    react(),
    // Bundle-Analyse: `ANALYZE=1 npm run build` erzeugt stats.html
    // (Treemap der Chunk-Größen) im Projektroot.
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: "stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
        port: 1438,
        strictPort: true,
        // Dev-only-Proxy: Browser-Origin (localhost:1438) → lokale Provider.
        // Im Release läuft der Transport über den Rust-Proxy (ollama_proxy.rs);
        // hier per Proxy, damit der Browser nicht cross-origin zu 127.0.0.1 zieht (CORS).
        proxy: {
          "/kilo":{ target: "https://api.kilocode.ai", changeOrigin: true, secure: false, rewrite: (p) => p.replace(/^\/kilo/, ""), proxyTimeout: 2000 },
          "/v1":   { target: "http://127.0.0.1:8000",  changeOrigin: true, secure: false, proxyTimeout: 2000 },
          "/api":  { target: "http://127.0.0.1:11434", changeOrigin: true, secure: false, proxyTimeout: 2000 },
          "/sdapi":{ target: "http://127.0.0.1:7860",  changeOrigin: true, secure: false, proxyTimeout: 2000 },
        },
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
          // docx/pdf-lib/jszip/epubjs bewusst NICHT als manualChunks: Sie werden
          // in services/export bzw. services/import nur dynamisch geladen und
          // bekommen so automatisch eigene, bedarfsgeladene Chunks. Ein manueller
          // 'export'-Chunk wurde dagegen beim App-Start vorgeladen (modulepreload),
          // weil export/index.ts statisch im Startup-Graph liegt.
          sqlite: ["sql.js"],
          state: ["zustand"],
        },
      },
    },
  },
});
