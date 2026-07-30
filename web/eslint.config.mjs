import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The dev/e2e build output (next.config.ts `distDir`, live-check Session 2
    // finding C). eslint-config-next only knows to ignore `.next`, so without this
    // `pnpm lint` walks into generated Turbopack chunks and reports their
    // `require()` calls and `@ts-ignore`s as our errors.
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated offline report bundle (minified esbuild output).
    "public/report-bundle/**",
  ]),
]);

export default eslintConfig;
