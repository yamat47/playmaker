# Playmaker 実装ロードマップ

`docs/prd.md` に基づく実装の進め方。grill-me プロセス（2026-05-16）で根から決定を積み上げ、以下に確定した。
実装中はこのドキュメントを判断の参照先とする。

## 前提

- 完全な greenfield（ソースコードなし、PRD 確定済み）
- closed / private な商用ソフト専用部品（OSS 化・npm 公開なし）
- ローカルで随時目視確認しながら進める / 単体テストを書きやすい構造を最優先

## 合意した設計（依存関係ツリー）

### 基盤（根・調査で確定）
- **TypeScript + pnpm + `demo/` 構成**（`.gitignore` の前提と一致。Node v25 / pnpm 11）

### レンダリングアーキテクチャ
- **Canvas 2D で描画コアを自前実装**（外部描画ライブラリなし — PRD 6.4 ランタイム依存最小）
  - **UI（ツールバー・プロパティパネル）は HTML/CSS オーバーレイ**（PRD 6.5 CSS 変数 / 6.3 フレームワーク非依存と整合。PNG エクスポート時に UI を別レイヤとして除外しやすい）
    - **公開 API はプレーン JS クラス `new Playmaker(container, options)` + バニラ DOM**。Shadow DOM・UI ランタイム依存なし、`--playmaker-*` 変数でテーマ化（Web Component ラッパーが必要なら MVP 後に薄く追加可）

### コードアーキテクチャ（VSCode 原則の軽量適用）
- **環境別レイヤ分離**（下位は上位に依存しない）
  - `src/common/` — DOM 非依存の純ロジック。**node 単体テストで機能カバレッジを全網羅**
  - `src/browser/` — DOM/Canvas 依存。`common` に依存
  - `src/playmaker.ts` — 公開エントリ。層を結線し options / onChange / view⇄edit を提供
  - **インターフェース抽出 + Model–View 分離 + コマンドパターン + Emitter/Disposable**
    - `IPlayModel` `IRenderer` `ICommand` `IUndoRedoService` `ICommandService` を抽出
    - テストは `IRenderer` 等をフェイク注入し Canvas なしでモデル・コマンド・Undo を完全検証
    - **DI は手動コンストラクタ注入のみ**（デコレータ / サービスコンテナ / 拡張レジストリは持たない＝MVP・依存最小）

#### 想定ディレクトリ

```
src/
  common/
    model/       # PlayData, version/migration
    geometry/    # bezier, hit-test, 座標変換
    commands/    # 編集操作=コマンド(addPlayer, drawRoute…)
    undoRedo/    # コマンドスタック
    events/      # Emitter/Event, Disposable(自前極小=VSCode base 相当)
    formations/  # フォーメーションテンプレートのデータ
  browser/
    rendering/   # Canvas レンダラ (IRenderer 実装)
    ui/          # ツールバー/プロパティパネル(バニラDOM)
    input/       # ポインタ→コマンド変換
  playmaker.ts   # 公開エントリ
demo/             # Vite playground アプリ（ローカル目視確認）
```

### ツールチェーン
- **Vite library mode に統合**（build + dev サーバ + Vitest を 1 ツール。UI CSS 配布に有利、設定面積最小）
  - **ローカル確認 = `demo/` Vite playground アプリ**（ホットリロード + シナリオ操作 UI。Storybook 不採用）
  - **テスト = `common` 層の node 単体テスト中心**で機能カバレッジ担保、`browser` 層は最小限、**VRT（視覚回帰）なし**

### 配布形態（deferrable）
- MVP は **git 依存 + `prepare` ビルドスクリプト + git タグ**を既定（`.gitignore` の `dist/` 除外＝prebuilt 非コミット方針と整合）
- 商用リポジトリ未存在のため最終決定は M9 で。プライベートレジストリ昇格余地は残す

## 進め方：縦スライス＋common先行ハイブリッド（M0→M9）

各マイルストーンは `common` をテスト付きで固めてから対応する `browser` を実装し、必ず `demo/` playground で目視できる成果で締める。

| M | 内容 | playground で確認できること | PRD |
|---|---|---|---|
| **M0** | 足場：Vite lib mode + `demo/` + Vitest(node) + TS/lint/format + CI 再構築（`.claude/` の Rails 前提 skill/agent/rule/CI を JS ライブラリ向けに置換） | 空 Canvas が出る・テスト/ビルドがローカルで回る | — |
| **M1** | フィールド描画：common(座標系・PlayData v1 型・geometry 基礎) + browser(3ゾーン・ヤードライン/ハッシュ/番号) | ゾーン切替を目視 | 5.1 |
| **M2** | 選手：common(モデル・6形状・ラベル/色・hit-test) + browser(描画) | PlayData 投入で選手表示 | 5.2 |
| **M3** | 線：common(route/block/motion・waypoint・bezier・hit-test) + browser(3線種) | PlayData で線表示 → **view モード完成** | 5.3 / 5.5 |
| **M4** | コマンド & Undo/Redo 基盤（**common のみ・UI なし**）：ICommand 群・IUndoRedoService・model mutation→onChange 発火 | node 単体テストで編集ロジック全網羅 | 5.4 基盤 |
| **M5** | edit UI：browser(ツールバー/パネル/バニラDOM/CSS変数・input→command) | 実際に編集 + Undo/Redo を目視 | 5.4 |
| **M6** | フォーメーションテンプレート（preset データ + 外部受け入れ API） | playground で読込 | 5.6 |
| **M7** | PNG エクスポート（編集 UI 除外） | ボタンで PNG 出力確認 | 5.7 |
| **M8** | データ連携仕上げ：PlayData 往復・version/migration 機構・onChange 契約確定 | JSON 往復を目視 | 5.8 / 6.6 |
| **M9** | 仕上げ：非機能（対象ブラウザ確認・perf 選手22+線20）・配布形態確定・最小ドキュメント・機能カバレッジ最終確認 | MVP 完了判定 | 6 / 7 |

### 実装メモ：フィールド座標と描画磨きの線引き（2026-05-16, M1）

見た目精緻化の依頼を「座標構造（後続ほど高コスト）」と「描画の磨き（renderer 隔離・PRD 4.1/4.2 で劣後）」に分離。構造のみ M1 で確定し、磨きは M9 仕上げへ集約する方針で合意。

**M1 で確定（common/geometry・テスト済）**
- 絶対ヤード定義域を **-10..110** に拡張（-10 自陣エンドライン / 0 自ゴール / 50 センター / 100 相手ゴール / 110 相手エンドライン）。エンドゾーン 10yd を座標系に内包
- ゾーン窓（常に 30yd 不変）: `own-redzone` = -10..20（自 EZ + 自陣 RZ） / `redzone` = 80..110（相手陣 RZ + 相手 EZ） / `middle` = 35..65
- `RED_ZONE_DEPTH_YARDS(20) + END_ZONE_DEPTH_YARDS(10) = ZONE_WINDOW_LENGTH_YARDS(30)`
- M2 選手・M3 線・M6 プリセットはこの最終座標系に乗せる（後の窓変更による手戻りを回避）

**M9 へ繰り延べ（renderer のみ・可逆）**
- サイドライン側のヤード目盛り列（現状は内側ハッシュ 2 列のみ）
- 1yd 刻みの精度・エンドゾーン内に 5yd 線を引かない等の実フィールド準拠
- エンドゾーンの面塗り／エンドライン／ゴールライン強調
- ヤード番号の向き（上下反転）・字体・配置の体裁

### 実装メモ：選手の形状セットと hit-test 近似（2026-05-16, M2）

PRD 5.2「形状（6 種）」の具体は未指定。戦術記法（O/X 等）の厳密再現より組み込みやすさ優先（PRD 4.1）で、描画・hit-test を一様に保てる**凸な幾何図形 6 種**に確定した。

**M2 で確定（common/model・geometry・テスト済）**
- 形状 6 種 = `circle` / `square` / `triangle` / `diamond` / `pentagon` / `hexagon`（すべて外接円が成立）
- マーカー半径は `PLAYER_RADIUS_YARDS`（ヤード）を common に置き、レンダラ描画と hit-test の当たり半径を同一値で共有（縦横等倍スケールゆえヤード空間の円判定がそのまま画面の円）
- hit-test は外接円近似・末尾優先（描画順 = 配列順、後の要素ほど上）。`FieldGeometry` に逆変換（Canvas px→ヤード）を追加し M5 入力の土台に
- `PlayData v1` に `players: Player[]` を合成。`resolvePlayData` が古い/不完全データを既定補完しつつ復元不能要素を除外（PRD 6.6 契約準備）

**M9 へ繰り延べ（renderer のみ・可逆）**
- アメフト記法準拠の見た目（オフェンス=○/ディフェンス=×等の意味づけ・塗り分け・線種）
- ラベルのはみ出し制御・字体・マーカー対サイズ比の体裁

### 実装メモ：線のデータ形状と曲線・hit-test 近似（2026-05-16, M3）

PRD 5.3「3 種類の線」の具体は未指定。戦術記法の厳密再現より組み込みやすさ優先（PRD 4.1）で、3 種を**構造で区別**し見た目磨きは M9 へ送る方針に確定した。

**M3 で確定（common/model・geometry・browser・テスト済）**
- `Line` = `id` / `kind`(`route`|`block`|`motion`) / `startPlayerId`(起点は常に選手) / `waypoints: FieldPosition[]`(0 個可) / `end` / `interpolation`(`straight`|`bezier`) / `color?` / `thickness?`。起点を選手 id に紐付け、選手が動けば線も追従する（M5 編集で活きる）
- 曲線は **Catmull-Rom → 3 次ベジェ変換**を common で「ヤード空間ポリラインへサンプリング」（`sampleLinePath`）。全制御点を必ず通る＝ route が waypoint を確実に経由。レンダラと hit-test が**同一ポリライン**を共有し見た目と当たりが一致。`straight` または実質 2 点以下は直線扱い
- hit-test は**サンプル後ポリラインへの点距離**（`distanceToSegment`）・許容半径 `LINE_HIT_TOLERANCE_YARDS`・末尾優先。起点選手が居ない線は描画されないので hit からも外す
- `normalizeLines(raw, validPlayerIds)`: 起点が実在選手でない／終点が数値でない線は復元不能として除外、種別・補間・id は既定補完、waypoint は不正要素のみ個別除外（PRD 6.6 契約準備）。`resolvePlayData` は players 確定後にその id 集合を渡す
- 描画順 = field → **lines → players**（線を選手の下に敷き、起点が選手で隠れて根元が綺麗）。`route` のみ終点に塗り矢印。`block` は太線・矢印なし、`motion` は破線。色は `--playmaker-line-{route,block,motion}-color`
- view モード = フルプレー（field+players+lines）の読み取り専用表示が完成（編集 UI は M5 まで存在しないため view で無効化すべき対象はまだ無い）。demo の mode 切替で往復可視

**M9 へ繰り延べ（renderer のみ・可逆）**
- アメフト記法準拠の体裁（block の T 字終端 / motion の波線 / route 種別ごとの矢じり形）
- 線の太さ・矢じり比・破線パターンの最終調整、選手マーカーと線端の重なり処理

### 実装メモ：JS カバレッジ計測の導入（2026-05-16）

規約「`common` 層は機能カバレッジを全網羅」を**機械化**するため、grill-me プロセスで根から決定を積み上げ確定した。greenfield の今が 100% を無痛で始められる唯一のタイミングという判断。

**確定（vite.config.ts の `test.coverage`・テスト済）**
- プロバイダ = **v8**（`@vitest/coverage-v8`、vitest と `^4.x` 整合）。AST-aware リマッピングで精度は istanbul 同等、計装なしで速く依存最小（PRD 6.4 と整合）
- 測定スコープ = `src/**/*.ts`（Vitest 4 では `include` 指定時に**未テストファイルも 0% で表に出る**のが既定＝ include 漏れで見かけ上 100% に見える事故を防ぐ。`coverage.all` は Vitest 4 で廃止のため指定しない）。除外は `**/*.test.ts` / `*.d.ts` のみ
- ゲート（しきい値）= **glob `src/common/**` のみ**に `lines/branches/functions/statements = 100` / `perFile: true`。`browser/` `playmaker.ts` `index.ts` は**測るが落とさない**（規約「common 全網羅・browser 最小限・VRT なし」と矛盾なく共存）
- 逃げ道は **`/* v8 ignore start -- <Why> */ … /* v8 ignore stop */` のみ**（PR レビューで承認）。ただし **ignore は最終手段**で、まず「ガードが要らない実装」を優先する（`noUncheckedIndexedAccess` の索引ガードは `for...of`、冗長な防御は削除）。全未カバー箇所を「意図的・監査済みの判断」にする。`autoUpdate` は使わない（初日から 100 固定）
- **`pnpm run test` = `vitest run --coverage`** に内蔵化。local-ci-runner / CI workflow / create-pr の 3 経路すべてにゲートが自動伝播し、定義箇所は vite.config.ts 1 か所。TDD 内側ループは `pnpm run test:watch`（カバレッジなし）で使い分け
- レポーター = `["text", "html", "json-summary"]`（text=Claude/CI ログ用に未カバー行可視、html=人間用、json-summary=将来連携用）
- 導入時の reality check で `emitter.ts`（dispose 後購読の実契約）と `hit-test.ts`（1 点ポリライン）にテスト追加。当初 ignore で除外した 3 箇所は**実装改善で解消**（hit-test の逆順 index ループ→`for...of`、冗長な空配列ガードは削除）。結果 **`src/` 内の `v8 ignore` は 0 件**で common 100% を達成

### 完了判定（PRD 7 章）
- 機能要件（PRD 5 章）すべてが仕様通り動作
- `common` 層の単体テストおよび統合テストが通る
- 実使用評価・事業性は商用ソフト側 PRD の責務（本ライブラリの範囲外）
