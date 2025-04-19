// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import node from "@astrojs/node";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  image: {
    domains: ["adzzhtf38t.ufs.sh"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "adzzhtf38t.ufs.sh",
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
