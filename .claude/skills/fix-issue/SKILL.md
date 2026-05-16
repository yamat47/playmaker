---
name: fix-issue
description: GitHub Issueを修正する。Issue番号を指定して、調査・実装・テスト・コミットまでを一貫して行う。
argument-hint: "[issue-number]"
disable-model-invocation: true
allowed-tools: Bash(gh:*), Read, Edit, Write, Grep, Glob
---

# GitHub Issue 修正

GitHub Issue $ARGUMENTS を調査し、修正を実装します。

## Step 1: Issue の確認

```bash
gh issue view $ARGUMENTS --json title,body,labels,assignees
```

## Step 2: 関連情報の収集

- Issue の要件と受け入れ基準を特定
- 関連するコードを調査
- 影響範囲を確認

## Step 3: 実装

### 実装方針

1. **アーキテクチャ規約に従う**（`.claude/rules/architecture.md`）
   - ロジックは DOM 非依存の `src/common/` に置く
   - 依存はインターフェース抽出 + 手動コンストラクタ注入
   - 編集操作はコマンドパターン、ライフサイクルは Disposable/Emitter

2. **最小限の変更**
   - Issue の要件に直接関係する変更のみ
   - リファクタリングは別 Issue で

3. **テストファースト**
   - 先にテストを書く（可能な場合）
   - `common` 層の単体テストを優先

## Step 4: 検証

```bash
# 型チェック
pnpm run typecheck

# テスト実行
pnpm run test

# Lint 実行
pnpm run lint
```

## Step 5: コミット

Conventional Commits 形式でコミット:

```
fix(scope): 日本語で概要

<body: why のみ。非自明な場合だけ書く>

Fixes #$ARGUMENTS
```

※ Claude Code のクレジット表記（`🤖 Generated with [Claude Code] ...`, `Co-Authored-By: Claude ...`）は付けない。

## チェックリスト

- [ ] Issue の要件を満たしている
- [ ] テストが追加されている（common 層中心）
- [ ] 既存のテストが通る
- [ ] 型エラー・Lint エラーがない
- [ ] アーキテクチャ規約（レイヤ分離 / IF 抽出 / コマンドパターン）に従っている

## 出力形式

```markdown
## Issue #$ARGUMENTS 対応完了

### 変更内容
- [変更ファイル1]: 説明
- [変更ファイル2]: 説明

### テスト結果
✅ Vitest: X passed (X)
✅ TypeScript / Biome: エラーなし

### コミット
`abc1234` fix(scope): 概要
```
