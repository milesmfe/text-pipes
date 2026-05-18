import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        generator: resolve(__dirname, "src/generator.mjs"),
        renderer: resolve(__dirname, "src/renderer.mjs"),
      },
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: [],
    },
  },
});
