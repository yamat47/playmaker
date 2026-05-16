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
  },
});
