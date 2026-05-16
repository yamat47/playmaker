/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// build: ライブラリモードで dist を生成する。
// test: src 配下の *.test.ts を node 環境で実行する（common 層中心）。
// dev playground は `pnpm dev`（= vite demo）で demo/ を root に起動する。
const root = import.meta.dirname;

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
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
      // v5: 全型定義を api-extractor で単一 playmaker.d.ts に束ねる
      bundleTypes: true,
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
