---
description: Vitest テスト規約。編集は仕様テストで確かめ、単体テストはモジュールの約束だけに絞る。
paths:
  - "library/src/**/*.test.ts"
  - "library/src/test-support/**"
---

# テスト規約

テストは実装の部品ではなく、利用者から見た振る舞いに付ける。内部の分け方を変えてもテストを書き換えずに済むようにするためである。

## 仕様テスト

編集の振る舞いは、`PlaySession` と `IEditorController` を境界にした仕様テストで確かめる。

- 置き場は `src/common/specs/<機能>.test.ts`。機能ごとに 1 ファイルにし、ソースファイルごとには置かない
- 入口は `src/test-support/play-driver.ts` の `openPlay`。操作はヤード座標（`yd(lateral, downfield)`）で行い、
  クリック、ドラッグ、作図の開始は `click`、`drag`、`startLine` を使う。ツールの切替、Undo、パネルからの編集は `editor` を直接呼ぶ
- 観測するのは、session の読み取り（`getPlayData()`、`getSnapshot()`、`fieldZone`）と `loadFormation` の戻り値、
  表示状態（`editor.getViewState()`、`editor.getFrame()`、`editor.getSelectedPlayer()`、`editor.getSelectedLine()`）、
  通知（`onChange`、`notified`、`session.onDidChange`、`session.onDidReset`）だけにする
- 購読していない状態を確かめるときだけ、`openPlay` を使わずに `PlaySession` を直接作る
- コマンド、interaction、preview、PlayModel のような内部のモジュールを import しない。
  図の組み立てに使う型と、`MAX_PLAYERS` のような公開された定数は使ってよい
- PlaySession と IEditorController は公開しない。ジェスチャ単位の API を互換つきで固定する便益が、今の利用者には無い

## 単体テスト

モジュールとしての約束を書けるものだけ、ソースと同じ階層に `*.test.ts` を置く。

- 対象は、bezier、polyline、field の座標変換、hit-test、color、keymap、base の Event と lifecycle、
  PlayData の正規化と `migratePlayData`、プリセット
- 公開の入口から観測できない数値計算は、単体テストで確かめる
- 仕様テストで確かめられる振る舞いを、内部のモジュールの単体テストで重ねて確かめない

## 書き方

- Vitest は `src/**/*.test.ts` を node 環境で実行する。globals は使わず、`describe` `it` `expect` `vi` は `vitest` から import する
- `describe` は機能か、単体テストならモジュールの名前にする。`it` は日本語で「どういう入力のとき、どうなるか」を書く
  （例: `it("選手をドラッグして離すと、動かした図を渡して 1 回だけ呼ぶ")`）。
  メソッド名で始めない。「正しく動く」「正常系」のように結果を言わない名前にしない
- 1 つの `it` は 1 つの振る舞いだけを確かめる。準備、操作、検証の段は空行で区切り、`// Arrange` のようなコメントは書かない
- テスト名とコメントに、カバレッジのどの分岐を通すかを書かない。書くのは振る舞いである
- スパイは `vi.fn()` で作り、`toHaveBeenCalledOnce` や `toHaveBeenCalledExactlyOnceWith` で確かめる。
  モンキーパッチやモジュールの差し替え（`vi.mock`）はしない
- 複数のテストで使う部品は `src/test-support/` に置く。coverage と build の対象外で、
  型検査は `tsconfig.test.json` がテストと一緒に行う

## 実行

- `make test`（全体、カバレッジゲート込み）、`make test FILE=<file>`（1 ファイル、ゲートなし）、
  `make test-watch`（カバレッジなし）
- `browser/` と `playmaker.ts` の結線は、今は demo で目視する（`run-demo` skill）

## カバレッジ（common 層 100% ゲート）

- しきい値は `src/common/**` だけに掛け、4 指標すべて 100%、`perFile: true` で判定する。
  `browser/` `playmaker.ts` `index.ts` は測るが落とさない。設定は `vite.config.ts` の `test.coverage` の 1 か所
- ゲートは `make test` に入っているので、ローカルでも CI でも同じ判定になる
- 落ちたら `text` レポーターの「Uncovered Line #s」を見て、次のどれかにする
  1. 利用者から届く振る舞いなら、仕様テストか単体テストを足す
  2. 仕様テストから届かず、利用者にも届かないコードなら消す
  3. `noUncheckedIndexedAccess` のためのガードのように到達しない防御コードに限り、
     `/* v8 ignore start -- <Why> */ … /* v8 ignore stop */` で外す。Why は必須で、PR のレビューで認める
- ローカルで未カバーの行を辿るときは `coverage/index.html`（gitignore 済み）を開く

## やらないこと

- スクリーンショットを比べる視覚回帰テスト（VRT）は採用しない
