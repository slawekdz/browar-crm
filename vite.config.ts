/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages serves the project under /browar-crm/; local dev and tests run at /.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Browar Pogórza CRM",
        short_name: "BP CRM",
        description: "Deale, firmy i katalog produktów Browaru Pogórza",
        theme_color: "#1f2937",
        background_color: "#111827",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ["**/*.{js,css,html,svg,png,webp,jpg}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: { cacheName: "product-images", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
