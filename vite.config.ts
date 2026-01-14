import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: [],
    external: ["postgres", "better-auth"],
  },
  build: {
    rollupOptions: {
      external: [
        "postgres",
        "better-auth",
        // Common subpaths
        "postgres/src/index.js",
        "postgres/src/connection.js",
        "postgres/src/types.js",
        "postgres/src/large.js",
      ],
    },
  },
  optimizeDeps: {
    exclude: ["postgres", "better-auth"],
  },
});
