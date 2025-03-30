import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["bin/index.ts"],
  format: ["esm"],
  minify: true,
  outDir: "dist",
})
