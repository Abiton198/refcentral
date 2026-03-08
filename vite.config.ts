import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import pkg from './package.json'; // standard import is usually enough

export default defineConfig({
  // 1. Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  base: "/",

  plugins: [
    react(),
    VitePWA({
      scope: "/",
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
        start_url: "/",
        icons: [
          { src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});