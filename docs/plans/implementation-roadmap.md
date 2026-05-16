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

### 完了判定（PRD 7 章）
- 機能要件（PRD 5 章）すべてが仕様通り動作
- `common` 層の単体テストおよび統合テストが通る
- 実使用評価・事業性は商用ソフト側 PRD の責務（本ライブラリの範囲外）
