---
description: Vitest テスト規約。common 層中心、インターフェース注入、AAA。
paths:
  - "src/**/*.test.ts"
---

# テスト規約

Playmaker は VSCode 流レイヤ分離を採る。テストは `common` 層（DOM 非依存の純ロジック）を厚く、`browser` 層は最小限にする。詳細方針は `docs/plans/implementation-roadmap.md`。

## 配置・命名

- ソースと同階層に `*.test.ts`（`src/common/event/emitter.ts` → `src/common/event/emitter.test.ts`）
- Vitest は `src/**/*.test.ts` を **node 環境**で実行（`vite.config.ts` の `test`）
- 実行: `pnpm run test`（全体・**カバレッジゲート内蔵**）/ `pnpm vitest run <file>`（個別）/ `pnpm run test:watch`（TDD 内側ループ・カバレッジなし）

## スタイル

- `describe` でユニット、`it` の主語は日本語で振る舞いを明確に
- AAA（Arrange / Act / Assert）。1 つの `it` は論理的に 1 振る舞い
- 正常系 → 異常系 → 境界値の順で網羅
- スパイは `vi.fn()`、`toHaveBeenCalledExactlyOnceWith` / `toHaveBeenCalledOnce` を活用

## テスト容易性の原則

- **ロジックは common に置き、DOM 非依存で単体テストする**。`document` 等を common のテストに持ち込まない
- 実装差し替えは**インターフェース注入**（`IRenderer` 等のフェイクをコンストラクタに渡す）。モンキーパッチ / 全インスタンス差し替えを避ける

```ts
// GOOD
const renderer: IRenderer = { render: vi.fn(), dispose: vi.fn() };
const subject = new SomeController(model, renderer);
```

## 重点的に網羅する対象（common 層）

- モデルの不変条件と `onChange` 発火
- コマンドの適用・取り消し（コマンドパターン）
- Undo / Redo スタックの遷移
- 幾何計算（bezier、hit-test、座標変換）
- PlayData の `version` と migration

## カバレッジ（common 層 100% ゲート）

- `pnpm run test` = `vitest run --coverage`。**ゲートはこのコマンドに内蔵**され local-ci / CI / create-pr の全経路で強制される。TDD 内側ループは `pnpm run test:watch`（カバレッジなし）
- しきい値は **`src/common/**` のみ** 4 指標すべて 100% / `perFile: true`（`browser/` `playmaker.ts` `index.ts` は測るが落とさない）。設定は `vite.config.ts` の `test.coverage` 1 か所
- 落ちたら `text` レポーターの「Uncovered Line #s」を見て対処:
  1. **テスト可能な振る舞い** → テスト追加（未カバー行を `test-writer` エージェントに渡すと速い）
  2. **到達不能な防御コード**（`noUncheckedIndexedAccess` 用ガード、非 export 関数の前提で到達しない分岐等）に限り `/* v8 ignore start -- <Why> */ … /* v8 ignore stop */` で除外。Why 必須・PR レビューで承認。安易な ignore で穴を隠さない
- ローカルで赤ハイライトを辿るなら `coverage/index.html`（gitignore 済）

## やらないこと

- 視覚回帰テスト（VRT）は採用しない（方針確定済み）
- E2E / ブラウザ自動操作は MVP 範囲外（`demo/` playground で手動目視）
