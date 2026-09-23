# Playmaker

アメリカンフットボールのプレー図を作成・表示する、UI フレームワーク非依存の
TypeScript ライブラリ。商用ソフトウェアに組み込む「図作成コア」であり、
永続化・認証・共有などホスト側の責務は持たない（詳細は `docs/prd.md`）。

クローズドな商用ソフト専用部品として管理する（npm 公開・OSS 化はしない）。

## インストール

プライベートリポジトリの git 依存として参照する。パッケージ本体はリポジトリの
`library/` にあるので、サブディレクトリを指定する（pnpm の `path:`）。`prepare` スクリプトが
インストール時に `dist/`（ESM / 型 / CSS）をビルドするため、ビルド成果物は
コミットしない。バージョンは **git タグ**で固定する。

```jsonc
// 利用側 package.json
{
  "dependencies": {
    "playmaker": "git+ssh://git@github.com/yamat47/playmaker.git#v1.0.0&path:/library"
  }
}
```

pnpm 11 は依存のビルドスクリプトを既定で実行せず、未承認のものがあると install を
失敗させる。`prepare` で `dist/` を作るには、利用側の `pnpm-workspace.yaml` の
`allowBuilds` で playmaker を許可する。キーはタグではなく、**タグが指すコミットの SHA** で
書く必要がある（`playmaker: true` やタグ名のキーでは許可されない）。

```yaml
# 利用側 pnpm-workspace.yaml
allowBuilds:
  "playmaker@git+ssh://git@github.com/yamat47/playmaker.git#<コミット SHA>&path:/library": true
```

正確なキーは、許可せずに `pnpm install` したときのエラーメッセージにそのまま表示される。
タグを上げたら SHA も変わるので、このキーも書き換える。

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
| `exportToPng(options?): Promise<Blob>` | 編集 UI を含まない PNG を出力。`options.width` で出力幅(px)。上限は 4096 |
| `dispose()` | DOM・購読・リソースを解放 |

再エクスポート: 型 `PlayData` `Player` `Line` `FieldPosition` `Formation`
`ImageExportOptions` `PlayerShape`(`circle`/`square`) `LineKind`(`route`/`block`/`motion`)
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
  Redo = `Shift` 併用 / `Y`。ツールバーは図の上、パネルは図の右に置き、図とは重ねない。
  図は container からそれらを除いた領域に収まる大きさで描く
- `view`: 読み取り専用。編集 UI は出さない

### スタイルのカスタマイズ

配色と UI のフォントは、CSS カスタムプロパティ `--playmaker-*` で上書きできる。
Playmaker を置いた要素か、その祖先の要素に指定する。
ヤード数字と選手ラベルのフォントは同梱のものに固定していて、上書きできない。

```css
.my-app {
  --playmaker-field-grass: #1b5e20;
  --playmaker-line-route: #ffd54f;
  --playmaker-selection: #ff9800;
  --playmaker-ui-accent: #1565c0;
  --playmaker-ui-font: "Inter", system-ui, sans-serif;
}
```

変数は `--playmaker-<部位>-<部品>` の形で、次のものがある。

- フィールド: `field-grass`、`field-stripe`、`field-oob`、`field-endzone`、`field-line`、`field-number`、`field-goal-line`、`field-pylon`、`field-goalpost`
- 選手: `player-fill`、`player-stroke`、`player-label`
- 線: `line-route`、`line-block`、`line-motion`、パネルで選べる 4 色の `line-swatch-1` から `line-swatch-4`
- 選択: `selection`、ハンドルの縁取りの `selection-outline`
- ツールバーとパネル: `ui-font`、`ui-surface`、`ui-border`、`ui-text`、`ui-accent`、押されたボタンの文字色の `ui-accent-text`

## 対応環境

モダンブラウザ（Chrome / Firefox / Safari / Edge の最新 2 バージョン）の
**デスクトップ環境のみ**。モバイル / タッチ・a11y・i18n は対象外（`docs/prd.md` 8 章）。

## 開発

```
library/     ライブラリ本体（src/・demo/・package.json・各種設定）
docker/      開発用イメージと compose
docs/        要件・設計・計画
Makefile     開発コマンドの入口
```

Node / pnpm はホストに入れず、Docker コンテナの中で動かす。ホストに必要なのは
`make` と Docker（Docker Desktop / colima など）だけ。

```sh
make setup          # イメージをビルドして依存を入れる（初回・Dockerfile 変更時）
make up             # library/demo/ playground を http://localhost:5173 で起動（make down で停止）
make test           # Vitest（common 層 100% カバレッジゲート内蔵）。FILE= で 1 ファイルだけ
make typecheck      # tsc -b（common・browser・test・tooling の 4 つの tsconfig）
make lint           # Biome（make fix で自動修正）
make build          # Vite library mode → library/dist/（ESM/型/CSS）
make check          # CI と同じ検証を一通り
make pnpm ARGS="add -D <pkg>"  # 任意の pnpm コマンド
make help           # ターゲット一覧
```

VS Code では「Dev Containers: Reopen in Container」で開くと、`library/` をワークスペースとして
エディタの型補完・Biome・Vitest Explorer がコンテナ内の `node_modules` を使って動く。
Dev Containers のターミナルからも同じ `make` ターゲットが使える（`up` / `down` などコンテナ操作系はホストから）。

設計判断の確定経緯は `docs/plans/implementation-roadmap.md`、要件は `docs/prd.md`、
コーディング規約は `.claude/rules/` を参照。
