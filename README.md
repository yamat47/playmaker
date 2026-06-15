# Playmaker

アメリカンフットボールのプレー図を作成・表示する、UI フレームワーク非依存の
TypeScript ライブラリ。商用ソフトウェアに組み込む「図作成コア」であり、
永続化・認証・共有などホスト側の責務は持たない（詳細は `docs/prd.md`）。

クローズドな商用ソフト専用部品として管理する（npm 公開・OSS 化はしない）。

## インストール

プライベートリポジトリの git 依存として参照する。`prepare` スクリプトが
インストール時に `dist/`（ESM / CJS / 型 / CSS）をビルドするため、ビルド成果物は
コミットしない。バージョンは **git タグ**で固定する。

```jsonc
// 利用側 package.json
{
  "dependencies": {
    "playmaker": "git+ssh://git@github.com/yamat47/playmaker.git#v1.0.0"
  }
}
```

Node.js 24 以上が必要。プライベートレジストリ（GitHub Packages 等）への昇格は、
商用リポジトリ着手時に再評価する余地として残している。

## 使い方

コンテナ要素とオプションを渡すだけで組み込める。スタイルは別途読み込む。

```ts
import { Playmaker, type PlayData } from "playmaker";
import "playmaker/styles.css";

const container = document.getElementById("play")!;

const playmaker = new Playmaker(container, {
  mode: "edit", // "edit"（既定・編集 UI あり）/ "view"（読み取り専用）
  initialData: savedPlayData, // 商用ソフトが永続化した PlayData（省略可）
  onChange: (data: PlayData) => {
    // 編集コマンド・Undo/Redo の確定ごとに 1 回、最新の深いスナップショットが届く。
    // そのまま JSON 化して永続化できる。
    persist(JSON.stringify(data));
  },
});
```

### 公開 API

| メンバー | 説明 |
|---|---|
| `new Playmaker(container, options?)` | 生成。`options` は `mode` / `initialData` / `onChange` |
| `getPlayData(): PlayData` | 現在のプレー図の正準スナップショット（深いコピー・`version` は現行） |
| `setPlayData(data)` | 永続化済み PlayData を丸ごと再読込（履歴はリセット・`onChange` は出ない） |
| `loadFormation(formation)` | フォーメーションを既存図へ追記（攻守プリセットを順に重ねられる） |
| `get fieldZone` / `setFieldZone(zone)` | フィールドゾーン（`middle` / `redzone` / `own-redzone`） |
| `exportToPng(options?): Promise<Blob>` | 編集 UI を含まない PNG を出力。`options.width` で出力幅(px) |
| `dispose()` | DOM・購読・リソースを解放 |

再エクスポート: 型 `PlayData` `Player` `Line` `FieldPosition` `Formation`
`ImageExportOptions` `PlayerShape`(6 種) `LineKind`(`route`/`block`/`motion`)
`LineInterpolation`(`straight`/`bezier`) ほか、値 `FORMATION_PRESETS`
`getFormationPreset(id)` `migratePlayData(raw)` `CURRENT_PLAY_DATA_VERSION`。

プリセット id: `i-formation` / `shotgun-spread`（攻）、`defense-4-3` /
`defense-nickel`（守）。商用ソフト側のカスタム隊形も `loadFormation` に渡せる。

### データ連携とバージョニング

- `onChange` は**編集コマンドおよび Undo/Redo の確定ごとに 1 回**、最新 PlayData の
  深いスナップショットを渡す。構築時・`setPlayData` 再読込・PNG 出力では発火しない
- `getPlayData()` はそのまま永続化でき、`setPlayData` / `initialData` に戻すと
  同値のプレー図に復元される（往復契約）
- 旧版・版なし・未来版・破損データを渡しても `migratePlayData` が現行スキーマへ
  寄せ、決して投げない（復元不能な要素のみ除外）。`PlayData.version` の真実源は
  `CURRENT_PLAY_DATA_VERSION`

### モード

- `edit`: ツールバー・プロパティパネル・ポインタ操作で編集。Undo = `Cmd/Ctrl+Z`、
  Redo = `Shift` 併用 / `Y`
- `view`: 読み取り専用。編集 UI は出さない（CSS でも保険的に非表示）

### スタイルのカスタマイズ

配色・フォント・サイズはすべて CSS カスタムプロパティ `--playmaker-*` で上書きできる
（商用ソフトのデザインシステムに追従）。`.playmaker-root` に対して指定する。

```css
.playmaker-root {
  --playmaker-field-bg: #1b5e20;
  --playmaker-line-route-color: #ffd54f;
  --playmaker-selection-color: #ff9800;
  --playmaker-accent-color: #1565c0;
  --playmaker-font-family: "Inter", system-ui, sans-serif;
}
```

主な変数: `--playmaker-font-family` / `--playmaker-field-bg` /
`--playmaker-field-line-color` / `--playmaker-field-number-color` /
`--playmaker-player-fill` / `--playmaker-player-stroke` /
`--playmaker-player-label-color` / `--playmaker-line-{route,block,motion}-color` /
`--playmaker-selection-color` / `--playmaker-surface-bg` /
`--playmaker-border-color` / `--playmaker-text-color` / `--playmaker-accent-color`。

## 対応環境

モダンブラウザ（Chrome / Firefox / Safari / Edge の最新 2 バージョン）の
**デスクトップ環境のみ**。モバイル / タッチ・a11y・i18n は対象外（`docs/prd.md` 8 章）。

## 開発

```sh
pnpm install        # 依存解決（prepare で dist もビルド）
pnpm dev            # demo/ playground をホットリロード起動（ローカル目視確認）
pnpm test           # Vitest（common 層 100% カバレッジゲート内蔵）
pnpm typecheck      # tsc --noEmit
pnpm lint           # Biome
pnpm build          # Vite library mode → dist/（ESM/CJS/型/CSS）
```

設計判断の確定経緯は `docs/plans/implementation-roadmap.md`、要件は `docs/prd.md`、
コーディング規約は `.claude/rules/` を参照。
