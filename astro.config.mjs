// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import node from "@astrojs/node";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  image: {
    domains: ["static.nb.com.ar"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.nb.com.ar",
        pathname: "/**",
      },
    ],
  },
  output: "server",
  adapter: vercel(), // o "middleware"
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
});
