/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// The demo dev server is started with `make up` (which runs vite demo).
const root = import.meta.dirname;

// The typescript package of TypeScript 7 ships neither the JS API nor lib.*.d.ts. vite-plugin-dts reads
// the JS API from @typescript/typescript6, but the lib location passed to api-extractor still points at the
// typescript package, so standard types such as Omit cannot be resolved and bundling the dts fails. Point
// the lib location at @typescript/old (= typescript@6), which @typescript/typescript6 depends on.
// The conditions for removing this are in "TypeScript 7 workaround" in docs/design.md.
const requireFromRoot = createRequire(import.meta.url);
const typescript6 = requireFromRoot.resolve("@typescript/typescript6/package.json");
const typescriptLibFolder = dirname(
  createRequire(typescript6).resolve("@typescript/old/package.json"),
);

// In environments without a Chromium matching the playwright version (cloud Claude Code sessions),
// point at the installed Chromium with CHROMIUM_PATH.
function chromiumLaunchOptions(): { executablePath?: string } {
  const executablePath = process.env.CHROMIUM_PATH;
  return executablePath === undefined ? {} : { executablePath };
}

export default defineConfig({
  resolve: {
    // From the demo, reference src directly with the same specifiers as a consumer of the distributed version.
    alias: [
      // A string would also prefix-match "@yamat47/playmaker/styles.css", so use an exact-match regular expression.
      { find: /^@yamat47\/playmaker$/, replacement: resolve(root, "src/playmaker.ts") },
      { find: "@yamat47/playmaker/styles.css", replacement: resolve(root, "src/styles.css") },
    ],
  },
  build: {
    lib: {
      entry: resolve(root, "src/playmaker.ts"),
      name: "Playmaker",
      // Consumers use only ESM through a bundler, so no CJS is emitted. Emitting CJS would hand
      // the ESM types to consumers that `require` it, and the types and the runtime would diverge.
      formats: ["es"],
      fileName: "playmaker",
      cssFileName: "playmaker",
    },
    // The bundled font (woff2) is inlined into the JS as a data URI. Consumers do not have to place
    // the font file or resolve its path. Other assets follow the default.
    assetsInlineLimit: (filePath) => (filePath.endsWith(".woff2") ? true : undefined),
    sourcemap: true,
  },
  plugins: [
    dts({
      // Use a build-only tsconfig to pin the root for emitting type declarations to src. Including demo or vite.config.ts
      // in include raises the common ancestor to the project root, and the type declarations end up under dist/src/.
      tsconfigPath: "tsconfig.build.json",
      // Type declarations are bundled with api-extractor into the single file dist/playmaker.d.ts.
      bundleTypes: {
        invokeOptions: { typescriptCompilerFolder: typescriptLibFolder },
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
        },
      },
      // Do not extend the root config, so the build-only dts plugin is not inherited.
      // Since Vitest 5, extends defaults to true for inline projects, so set false explicitly.
      {
        extends: false,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: chromiumLaunchOptions() }),
            instances: [{ browser: "chromium" }],
            // If the test iframe does not fit in the Playwright page (1280x720), Vitest scales the iframe down to show it.
            // Scaling shifts the in-element positions passed to userEvent depending on the operation, so use a size that needs no scaling.
            viewport: { width: 1000, height: 640 },
            // Screenshots on failure are written to .vitest/attachments/.
            // We do not compare screens as a practice, so do not take them.
            screenshotFailures: false,
          },
        },
      },
    ],
    coverage: {
      // Unlike istanbul, it does not instrument the code, so the tests do not slow down.
      provider: "v8",
      // Files matching include appear in the table as 0% even if no test reads them.
      // Narrowing include hides files without tests from the table and makes it look like 100%, so include everything under src.
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "src/test-support/**"],
      // text is for seeing uncovered lines in the log, html for viewing side by side with the source locally.
      reporter: ["text", "html"],
      thresholds: {
        // Only common fails the gate. browser and playmaker.ts need the DOM, and the node tests cannot reach them.
        "src/common/**": {
          // In an overall average, well-covered files hide thinly covered ones, so judge per file.
          // Since Vitest 5, the top-level perFile does not apply to glob thresholds.
          perFile: true,
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
