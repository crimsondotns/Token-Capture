import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: path.resolve("spa"),
  base: "/Token-Capture/",
  publicDir: path.resolve("public"),
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: { "@": path.resolve("src") },
  },
  define: {
    "import.meta.env.VITE_PAGES": JSON.stringify("true"),
  },
  build: {
    outDir: path.resolve("dist-pages"),
    emptyOutDir: true,
  },
});
