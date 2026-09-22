/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// build: ライブラリモードで dist を生成する。
// test: src 配下の *.test.ts を node 環境で実行する（common 層中心）。
// dev playground は `pnpm dev`（= vite demo）で demo/ を root に起動する。
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
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "playmaker.js" : "playmaker.cjs"),
      cssFileName: "playmaker",
    },
    // 同梱フォント（woff2）は data URI として playmaker.css へ inline する＝利用側は
    // css を読むだけでよく、別ファイル配置やパス解決が要らない。他アセットは既定に従う。
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
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    coverage: {
      // v8 ネイティブ計測 + AST-aware リマッピング。計装なしで速く、精度は istanbul 同等
      provider: "v8",
      // include に一致するファイルは未テストでも 0% として表に出る（Vitest 4 既定）。
      // include 漏れで見かけ上 100% に見える事故を防ぐため src 配下を明示列挙する。
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
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
