import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "SPLIT — Cube Timer",
        short_name: "SPLIT",
        description: "キューブの計測と練習記録",
        lang: "ja",
        theme_color: "#2459e0",
        background_color: "#f5f7fb",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  worker: { format: "es" },
  build: {
    target: "es2022",
    // cubing.js loads shared ESM chunks inside Workers, where DOM preloading cannot run.
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "cubing",
              test: /node_modules[\\/](cubing|@cubing)[\\/]/,
              entriesAware: true,
            },
          ],
        },
      },
    },
  },
}));
