import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "drizzle/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "scripts/**", // Ignore scripts folder
      "public/**", // Ignore public assets (browser-compatible JS)
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        EventTarget: "readonly",
        ReadableStream: "readonly",
        WritableStream: "readonly",
        TransformStream: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        performance: "readonly",
        // Test globals
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        test: "readonly",
      },
    },
    rules: {
      // Disable overly strict rules
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",

      // Dark mode regression prevention
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}$/]",
          message:
            "❌ Hardcoded hex colors are prohibited. Use semantic tokens instead:\n" +
            "  ✅ backgroundColor: 'var(--surface)'\n" +
            "  ✅ color: 'var(--foreground)'\n" +
            "  ✅ borderColor: 'var(--border)'\n" +
            "  ✅ import { semanticColors } from 'lib/utils/semantic-colors'\n" +
            "Allowed exceptions: 'transparent', 'currentColor', 'inherit'\n" +
            "See: docs/DARK_MODE_GUIDE.md",
        },
        {
          selector: "Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]",
          message:
            "❌ Hardcoded RGB/HSL colors are prohibited. Use semantic tokens instead:\n" +
            "  ✅ backgroundColor: 'var(--surface)'\n" +
            "  ✅ color: 'var(--foreground)'\n" +
            "See: docs/DARK_MODE_GUIDE.md",
        },
      ],
    },
  },
  // Exempt files with legitimate hardcoded color use cases
  {
    files: [
      "app/routes/tenant/settings/public-site*.tsx",  // User theming interface
      "app/routes/tenant/reports/export.pdf.tsx",     // PDF generation library
      "app/routes/**/print-*.tsx",                     // Print templates
      "app/routes/tenant/bookings/$id.tsx",           // HTML email templates
      "app/routes/tenant/dive-sites/$id.tsx",         // HTML embed templates
    ],
    rules: {
      "no-restricted-syntax": "off",  // Allow hardcoded colors in these specific files
    },
  },
  // Playwright E2E test-specific rules
  {
    files: ["tests/e2e/**/*.{ts,tsx,js,jsx}", "tests/e2e/**/*.page.{ts,tsx}"],
    rules: {
      // Prevent usage of waitForTimeout (anti-pattern that causes flaky tests)
      "no-restricted-syntax": [
        "warn", // Downgraded from "error" to allow existing 679 instances (see DIVE-ika)
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            "❌ waitForTimeout() is prohibited. Use condition-based waiting instead:\n" +
            "  ✅ await page.waitForLoadState('networkidle')\n" +
            "  ✅ await locator.waitFor({ state: 'visible' })\n" +
            "  ✅ await expect(locator).toBeVisible({ timeout: 10000 })\n" +
            "See: tests/e2e/workflow/customer-management.spec.ts for examples\n" +
            "Related: KAN-625, DIVE-ika",
        },
      ],
    },
  }
);
