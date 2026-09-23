/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// demo の dev サーバーは `make up` で起動する（中身は vite demo）。
const root = import.meta.dirname;

// TypeScript 7 の typescript パッケージは JS API も lib.*.d.ts も同梱しない。vite-plugin-dts は
// JS API を @typescript/typescript6 から読むが、api-extractor に渡す lib の場所は typescript
// パッケージのままなので、Omit などの標準型を解決できず dts の束ねに失敗する。lib の場所は
// @typescript/typescript6 が依存する @typescript/old（= typescript@6）に向ける。
// 外す条件は docs/design.md の「TypeScript 7 の回避策」に置く。
const requireFromRoot = createRequire(import.meta.url);
const typescript6 = requireFromRoot.resolve("@typescript/typescript6/package.json");
const typescriptLibFolder = dirname(
  createRequire(typescript6).resolve("@typescript/old/package.json"),
);

// playwright の版に合う Chromium が入っていない環境（cloud 版の Claude Code のセッション）では、
// CHROMIUM_PATH で入っている Chromium を指す。
function chromiumLaunchOptions(): { executablePath?: string } {
  const executablePath = process.env.CHROMIUM_PATH;
  return executablePath === undefined ? {} : { executablePath };
}

export default defineConfig({
  resolve: {
    // demo からは、配布版を使う利用者と同じ指定子で src を直接参照する。
    alias: [
      // 文字列で指定すると "playmaker/styles.css" にも前方一致するので、完全一致の正規表現にする。
      { find: /^playmaker$/, replacement: resolve(root, "src/playmaker.ts") },
      { find: "playmaker/styles.css", replacement: resolve(root, "src/styles.css") },
    ],
  },
  build: {
    lib: {
      entry: resolve(root, "src/playmaker.ts"),
      name: "Playmaker",
      // 利用側はバンドラ経由の ESM だけなので CJS は出さない。CJS を出すと、
      // require した利用者にも ESM 用の型が渡って型と実体がずれる。
      formats: ["es"],
      fileName: "playmaker",
      cssFileName: "playmaker",
    },
    // 同梱フォント（woff2）は data URI として JS へ inline する。利用側はフォントのファイルを
    // 配置したりパスを解決したりしなくてよい。他のアセットは既定に従う。
    assetsInlineLimit: (filePath) => (filePath.endsWith(".woff2") ? true : undefined),
    sourcemap: true,
  },
  plugins: [
    dts({
      // 型定義を書き出す起点を src に固定するため、build 専用の tsconfig を使う。demo や vite.config.ts を
      // include に含めると共通の祖先がプロジェクトのルートに上がり、型定義が dist/src/ の下に出てしまう。
      tsconfigPath: "tsconfig.build.json",
      // 型定義は api-extractor で dist/playmaker.d.ts の 1 ファイルに束ねる。
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
      // build 用の dts plugin を引き継がないよう、root の設定は extends しない。
      {
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: chromiumLaunchOptions() }),
            instances: [{ browser: "chromium" }],
            // テストの iframe が Playwright のページ（1280x720）に収まらないと、Vitest は iframe を縮めて映す。
            // 縮めると userEvent に渡す要素内の位置が操作によってずれるので、縮めずに済む大きさにする。
            viewport: { width: 1000, height: 640 },
            // 失敗したときのスクリーンショットはテストの隣の __screenshots__ に書き出される。
            // 画面を見比べる運用はしないので撮らない。
            screenshotFailures: false,
          },
        },
      },
    ],
    coverage: {
      // istanbul と違ってコードを計装しないので、テストが遅くならない。
      provider: "v8",
      // include に一致するファイルは、テストが 1 つも読まなくても 0% として表に出る。
      // include を絞ると、テストの無いファイルが表から消えて 100% に見えるので、src の下をすべて入れる。
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "src/test-support/**"],
      // text はログで未カバーの行を見るため、html は手元でソースと並べて見るため。
      reporter: ["text", "html"],
      thresholds: {
        // 全体の平均では、よく網羅したファイルが網羅の薄いファイルを隠すので、ファイルごとに判定する。
        perFile: true,
        // 落とすのは common だけにする。browser と playmaker.ts は DOM が要り、node のテストでは届かない。
        "src/common/**": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
