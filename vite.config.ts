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
      external: (id) => {
        // Exclude postgres and better-auth from client bundle
        if (id === "postgres" || id.startsWith("postgres/")) return true;
        if (id === "better-auth" || id.startsWith("better-auth/")) return true;
        return false;
      },
    },
  },
  optimizeDeps: {
    exclude: ["postgres", "better-auth"],
  },
});
