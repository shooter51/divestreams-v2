import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import istanbul from "vite-plugin-istanbul";

const enableCoverage = process.env.E2E_COVERAGE === "true";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    // Enable Istanbul instrumentation for E2E coverage collection
    enableCoverage &&
      istanbul({
        include: ["app/**/*", "lib/**/*"],
        exclude: ["node_modules", "tests/**/*", "**/*.test.*"],
        extension: [".ts", ".tsx"],
        requireEnv: false,
        forceBuildInstrument: true,
      }),
  ].filter(Boolean),
  ssr: {
    noExternal: [],
    external: ["postgres", "better-auth"],
  },
  resolve: isSsrBuild
    ? {}
    : {
        alias: {
          // Stub server-only modules for client build
          postgres: "./lib/stubs/postgres-stub.js",
        },
      },
  optimizeDeps: {
    exclude: ["postgres", "better-auth"],
  },
}));
