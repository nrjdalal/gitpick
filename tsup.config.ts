import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: true,
  outDir: "dist",
  external: [
    "@clack/prompts",
    "commander",
    "simple-git",
    "terminal-link",
    "yoctocolors",
    "zod",
    "zod-validation-error",
  ],
})
