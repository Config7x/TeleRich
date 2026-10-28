import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

// Mini app build: a single self-contained index.html that the worker inlines.
export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(here, "src") } },
  build: {
    outDir: path.resolve(here, "dist"),
    emptyOutDir: true,
    target: "es2020",
  },
  publicDir: path.resolve(here, "public"),
  define: { __REPO_ROOT__: JSON.stringify(repo) },
});
