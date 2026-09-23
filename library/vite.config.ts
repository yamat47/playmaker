/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// build: ライブラリモードで dist を生成する。
// test: src 配下の *.test.ts を node 環境で、*.browser.test.ts を Chromium で実行する。
// demo の dev サーバーは `make up` で起動する（中身は vite demo）。
const root = import.meta.dirname;

// TypeScript 7 の typescript パッケージは JS API も lib.*.d.ts も同梱しない。vite-plugin-dts は
// JS API を @typescript/typescript6 から読むが、api-extractor に渡す lib の場所は typescript
// パッケージのままなので、Omit などの標準型を解決できず dts の束ねに失敗する。lib の場所は
// @typescript/typescript6 が依存する @typescript/old（= typescript@6）に向ける。
// 外す条件は docs/plans/implementation-roadmap.md の「TypeScript 7 移行」に置く。
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
    alias: {
      // demo からは `import { Playmaker } from "playmaker"` で src を直接参照する。
      playmaker: resolve(root, "src/playmaker.ts"),
    },
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
      // dts emit のルートを src に固定する専用 tsconfig。demo / vite.config.ts を
      // include に含めると共通祖先がプロジェクトルートに上がり、dts が dist/src/* に
      // 出てしまうため build 用は分離する
      tsconfigPath: "tsconfig.build.json",
      // v5: 全型定義を api-extractor で単一 dist/playmaker.d.ts に束ねる
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
      // v8 ネイティブ計測 + AST-aware リマッピング。計装なしで速く、精度は istanbul 同等
      provider: "v8",
      // include に一致するファイルは未テストでも 0% として表に出る（Vitest 4 既定）。
      // include 漏れで見かけ上 100% に見える事故を防ぐため src 配下を明示列挙する。
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "src/test-support/**"],
      // text=Claude/CI ログ用(未カバー行が見える), html=人間用, json-summary=将来連携用
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        // 集計平均でごまかせないようファイル単位で判定する
        perFile: true,
        // ゲートは common 層のみ。browser/ playmaker.ts/ index.ts は測るが落とさない
        // （規約「common 全網羅・browser 最小限・VRT なし」を機械化）
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
