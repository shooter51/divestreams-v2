import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: [],
    external: ["postgres", "better-auth"],
  },
  resolve: {
    alias: isSsrBuild
      ? {}
      : {
          // Stub server-only modules for client build
          postgres: path.resolve(__dirname, "lib/stubs/postgres-stub.js"),
        },
  },
  optimizeDeps: {
    exclude: ["postgres", "better-auth"],
  },
}));
