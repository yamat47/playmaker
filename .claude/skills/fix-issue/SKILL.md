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

1. **DHH/37signals パターンに従う**
   - サービスオブジェクトは使用しない
   - カスタムアクションは新しいコントローラーへ
   - Concernsはドメイン関心事で分割

2. **最小限の変更**
   - Issue の要件に直接関係する変更のみ
   - リファクタリングは別 Issue で

3. **テストファースト**
   - 先にテストを書く（可能な場合）
   - Request Spec を優先

## Step 4: 検証

```bash
# テスト実行
./bin/dcc exec bundle exec rspec

# Lint 実行
./bin/dcc exec bundle exec rubocop
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
- [ ] テストが追加されている
- [ ] 既存のテストが通る
- [ ] Lint エラーがない
- [ ] DHH パターンに従っている
- [ ] 日本語コメントがマイグレーションに含まれている（DB変更時）

## 出力形式

```markdown
## Issue #$ARGUMENTS 対応完了

### 変更内容
- [変更ファイル1]: 説明
- [変更ファイル2]: 説明

### テスト結果
✅ RSpec: X examples, 0 failures
✅ RuboCop: no offenses

### コミット
`abc1234` fix(scope): 概要
```
