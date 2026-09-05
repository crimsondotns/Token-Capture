import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// A project page is served from /<repo>/, so the base has to match the
// repository's name - and renaming the repository silently breaks the build
// when that name is written out by hand. Actions already knows it.
const repo = (process.env.GITHUB_REPOSITORY ?? "").split("/")[1];
const base = process.env.PAGES_BASE || (repo ? `/${repo}/` : "/");

export default defineConfig({
  root: path.resolve("spa"),
  base,
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
