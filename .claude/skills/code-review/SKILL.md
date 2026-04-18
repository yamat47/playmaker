---
name: code-review
description: コード変更をレビューする。PRレビュー、セキュリティ、パフォーマンス、Rails規約のチェックに使用。
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob, Bash(git:*)
---

# コードレビュー

コード変更を多角的にレビューし、問題点と改善案を報告します。

## コンテキスト

- 現在のブランチ: !`git branch --show-current`
- 変更ファイル: !`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`

## レビュー観点

### 1. セキュリティ

- [ ] SQLインジェクション（`where("...")` → `where(...)` or `sanitize_sql`）
- [ ] XSS脆弱性（`raw`, `html_safe` の不適切な使用）
- [ ] Mass Assignment（Strong Parameters の漏れ）
- [ ] 認証・認可の抜け（`before_action` の漏れ）
- [ ] 機密情報のログ出力

### 2. パフォーマンス

- [ ] N+1クエリ（`includes` の漏れ）
- [ ] 不要なデータ取得（`select` で必要なカラムのみ）
- [ ] インデックス不足
- [ ] カウンターキャッシュの検討

### 3. Rails/DHH規約

- [ ] サービスオブジェクト使用 → モデルメソッドへ
- [ ] カスタムコントローラーアクション → 新しいリソースへ
- [ ] Concernsはドメイン関心事で分割されているか
- [ ] スコープで表現できるQuery Objectはないか

### 4. テスト

- [ ] 新機能にテストがあるか
- [ ] 境界値・エラーケースのテスト
- [ ] `allow_any_instance_of` は避けているか

### 5. コード品質

- [ ] メソッドが長すぎないか（10行目安）
- [ ] 適切な命名か
- [ ] 重複コードはないか
- [ ] マジックナンバーは定数化されているか

## 出力形式

```markdown
## レビュー結果サマリー

| カテゴリ | 件数 | 重要度 |
|---------|------|--------|
| セキュリティ | X件 | 🔴 |
| パフォーマンス | X件 | 🟡 |
| Rails規約 | X件 | 🟡 |
| テスト | X件 | 🟢 |
| コード品質 | X件 | 🟢 |

## 詳細

### 🔴 Critical: [ファイルパス:行番号]

**問題**: ...
**改善案**: ...

### 🟡 Warning: [ファイルパス:行番号]

**問題**: ...
**改善案**: ...

### 🟢 Suggestion: [ファイルパス:行番号]

**提案**: ...
```

## 注意事項

- 重要度: 🔴 Critical > 🟡 Warning > 🟢 Suggestion
- 具体的なコード例で改善案を示す
- DHH/37signals パターンを参照
