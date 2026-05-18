import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: resolve(__dirname, "tsconfig.json"),
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        generator: resolve(__dirname, "src/generator.ts"),
        renderer: resolve(__dirname, "src/renderer.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
    },
    sourcemap: true,
    rollupOptions: {
      external: ["opentype.js", "svg-path-properties"],
    },
  },
});
