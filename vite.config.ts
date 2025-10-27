import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  base: "./", // ✅ important for Netlify + PWA paths
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),

    // ✅ Progressive Web App setup
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "icons/icon-192x192.png",
        "icons/icon-512x512.png",
      ],
      manifest: {
        name: "Referee Management App",
        short_name: "RefCentral",
        description: "Manage appointments, reports, and results seamlessly.",
        theme_color: "#10b981",
        background_color: "#ffffff",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
