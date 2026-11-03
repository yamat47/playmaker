# @yamat47/playmaker

アメリカンフットボールのプレー図を作成・表示する、UI フレームワーク非依存の TypeScript ライブラリ。
コンテナ要素に図を描き、編集 UI を置き、編集のたびに `PlayData` を渡す。永続化や共有は持たない。

- デモ: https://playmaker-demo.yamat47.me/
- ソースと詳しい使い方: https://github.com/yamat47/playmaker

## インストール

```sh
npm install @yamat47/playmaker
```

```ts
import { Playmaker, type PlayData } from "@yamat47/playmaker";
import "@yamat47/playmaker/styles.css";

const playmaker = new Playmaker(document.getElementById("play")!, {
  mode: "edit", // "edit"（既定・編集 UI あり）/ "view"（読み取り専用）
  initialData: saved, // 永続化しておいた PlayData（省略可）
  onChange: (data: PlayData) => save(JSON.stringify(data)),
});
```

バンドラを通さず、CDN から読むこともできる。依存は無く、フォントは JS に同梱してある。
URL の `0.1.0` は使う版に置き換える。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.css" />
<div id="play" style="width: 960px; height: 600px"></div>
<script type="module">
  import { Playmaker } from "https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.js";
  new Playmaker(document.getElementById("play"));
</script>
```

モダンブラウザと PC のマウス操作を想定する。

## できること

- 選手（丸・四角）とラベル、ルート・ブロック・モーションの線を置き、ドラッグで動かす
- 位置は 0.5 ヤードの格子に揃う
- 同梱のフォーメーションとプレーのプリセットを読み込む（`FORMATION_PRESETS`、`PLAY_PRESETS`）
- 編集 UI を含まない PNG を書き出す（`exportToPng`）
- 色とフォントは CSS 変数（`--playmaker-*`）でホストに合わせる

公開 API の一覧、`PlayData` の形、テーマの変数は、リポジトリの README にある。

## ライセンス

MIT
