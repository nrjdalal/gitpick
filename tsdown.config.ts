import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  entry: ["bin/index.ts"],
  minify: true,
  outDir: "dist",
})
