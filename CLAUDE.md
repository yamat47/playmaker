# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

Playmaker は Web ベースの 11 人制アメリカンフットボールのプレイ図作成ツールです。npm パッケージとして配布されます。

詳細は @README.md を参照してください。

## 作業の進め方

### 実装フロー

実装タスクは必ず以下のフローで進めること：

1. **設計フェーズ（plan モード）**
   - 実装を始める前に、必ず plan モードに入る
   - 要件の確認、アーキテクチャの検討、影響範囲の把握を行う
   - 設計内容をユーザーに提示し、承認を得る

2. **実装フェーズ**
   - 設計が承認された後、実装を進める
   - TodoWrite を活用してタスクを管理する
   - 実装完了後、テストとリントを実行する

### 例外

以下の場合は plan モードをスキップしてよい：

- 単純なタイポ修正
- 明らかなバグの修正（1-2 行の変更）
- ユーザーから詳細な指示がある場合

## 技術スタック

- **フレームワーク**: React 18/19, TypeScript
- **キャンバス**: Konva.js (react-konva)
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS
- **ビルド**: Vite (library mode)
- **テスト**: Vitest + Testing Library
- **Node.js**: >= 18

## ディレクトリ構造

```
playmaker/
├── src/           # ライブラリのソースコード
│   ├── store/     # Zustand ストア
│   ├── types/     # 型定義
│   └── test/      # テストセットアップ
├── demo/          # デモアプリケーション
├── dist/          # ビルド成果物
└── docs/          # ドキュメント
```

## 開発コマンド

| コマンド            | 説明                         |
| ------------------- | ---------------------------- |
| `pnpm dev`          | ウォッチモードでビルド       |
| `pnpm build`        | ライブラリをビルド           |
| `pnpm demo`         | デモページを起動             |
| `pnpm test`         | テストをウォッチモードで実行 |
| `pnpm test:run`     | テストを一度だけ実行         |
| `pnpm typecheck`    | TypeScript 型チェック        |
| `pnpm lint`         | ESLint 実行                  |
| `pnpm lint:fix`     | ESLint 自動修正              |
| `pnpm format`       | Prettier でフォーマット      |
| `pnpm format:check` | フォーマットのチェック       |

## コーディング規約

### TypeScript

- strict モードを有効化
- `any` と `@ts-ignore` は使用しない
- 型定義は `src/types/` に配置

### React

- 関数コンポーネントのみ使用
- クラスコンポーネントは使用しない
- Hooks パターンを使用

### コードスタイル

- ESLint と Prettier の設定に従う
- husky + lint-staged でコミット時に自動チェック

## Git ワークフロー

### ブランチ命名

- 機能追加: `feature/簡潔な説明`
- バグ修正: `fix/バグの説明`
- その他: `chore/タスクの説明`

### コミットメッセージ

Conventional Commits 形式を使用：

```
type(scope): 簡潔な説明

詳細な説明（必要に応じて）
```

types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## テスト

- Vitest + React Testing Library を使用
- テストファイルは `*.test.ts` または `*.test.tsx`
- 実装完了後は必ず `pnpm test:run` で確認

## 品質チェック

PR を作成する前に以下を実行：

```bash
pnpm typecheck && pnpm lint && pnpm test:run && pnpm build
```
