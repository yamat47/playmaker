---
description: Playmaker のアーキテクチャ規約。VSCode 流レイヤ分離、IF 抽出、コマンドパターン。
paths:
  - "src/**/*.ts"
  - "vite.config.ts"
---

# アーキテクチャ規約

Playmaker はアメフトのプレー図を作成・表示する UI フレームワーク非依存の TypeScript ライブラリ。
最優先価値は **商用ソフトへの組み込みやすさ**。設計判断の確定経緯は `docs/plans/implementation-roadmap.md`、要件は `docs/prd.md`。

## 核心原則：VSCode 流レイヤ分離の軽量適用

下位層は上位層に依存しない。

```
src/
  common/    # DOM 非依存の純ロジック。node 単体テストで機能カバレッジを全網羅
  browser/   # DOM / Canvas 依存。common に依存
  playmaker.ts  # 公開エントリ。層を結線し options / onChange / view⇄edit を提供
```

- **新しいロジックは原則 `common/` に置く**。DOM API（`document` `window` `Canvas`）を `common/` に持ち込まない
- `browser/` は `common/` の**インターフェース**に依存し、描画・入力・UI を担う

## 守るべきパターン

### 1. インターフェース抽出
`IPlayModel` `IRenderer` `ICommand` `IUndoRedoService` `ICommandService` 等を抽出し、実装を差し替え・モック可能にする。`browser` は具象でなく IF に依存する。

### 2. Model–View 分離
純粋な `PlayModel`（`common`）が状態を持ち、`onChange` / イベントを発火。View（`browser`）は購読して描画。View からモデルを直接書き換えない。

### 3. コマンドパターン
すべての編集操作を `ICommand`（apply / undo）として表現し、Undo/Redo を単一機構に統一。UI なしで `common` 単体テストできる形にする。

### 4. ライフサイクル
`Disposable` / `DisposableStore` / `Emitter`（`src/common`）でリソースとイベント購読を束ねる。`_register` で従属リソースを登録し、`dispose()` で確実に解放（リーク防止）。

### 5. DI は手動コンストラクタ注入のみ
依存はコンストラクタ引数で渡す。デコレータ / サービスコンテナ / 拡張レジストリは持たない（MVP・依存最小）。

## 使わない / 持ち込まない

| 使わない | 代わりに |
|---|---|
| UI フレームワーク（React/Vue 等）への依存 | バニラ DOM + クラス API（`new Playmaker(container, options)`） |
| 外部描画ライブラリ（Konva 等） | Canvas 2D 自前実装 |
| Shadow DOM | ルートクラスで CSS スコープ + `--playmaker-*` 変数でテーマ化 |
| 重い DI 機構 | 手動コンストラクタ注入 |
| 不要なランタイム依存 | 標準 Web API（PRD 6.4 依存最小） |

## スタイル / ツール

- 言語: TypeScript（strict）。lint/format は Biome（`pnpm run lint` / `lint:fix`）
- ビルド: Vite library mode（`pnpm run build` → `dist/` に ESM/CJS/CSS/型）
- ローカル確認: `pnpm run dev`（`demo/` playground、ホットリロード）
- UI 文言・コメントは日本語（i18n 機構は持たない＝日本語のみ）
- コメントは Why を書く。コードを読めば分かる What は書かない
