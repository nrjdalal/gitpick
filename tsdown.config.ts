import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["bin/index.ts"],
  minify: true,
})
