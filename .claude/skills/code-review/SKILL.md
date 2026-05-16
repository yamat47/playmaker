---
name: code-review
description: コード変更をレビューする。PRレビュー、セキュリティ、パフォーマンス、アーキテクチャ規約のチェックに使用。
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

### 1. セキュリティ（クライアントサイド TS ライブラリの脅威モデル）

- [ ] DOM ベース XSS（外部由来 `PlayData` 文字列を `innerHTML`/`insertAdjacentHTML` に渡していないか。`textContent` を使う）
- [ ] プロトタイプ汚染（`PlayData` 復元/マージで `__proto__`/`constructor`/`prototype` を弾いているか）
- [ ] `eval`/`new Function`/文字列 `setTimeout`/`document.write` の不使用
- [ ] 巨大入力での DoS・ReDoS（境界チェック）
- [ ] 不要なランタイム依存の追加がないか（PRD 6.4 依存最小）

### 2. パフォーマンス

- [ ] 描画ループ・再描画が選手22+線20 で遅延しないか（不要な全再描画の回避）
- [ ] イベントリスナ・ResizeObserver 等のリーク（Disposable で確実に解放しているか）
- [ ] 幾何計算の重複・不要なアロケーション

### 3. アーキテクチャ規約（`.claude/rules/architecture.md`）

- [ ] ロジックが `src/common/`（DOM 非依存）に置かれ、`browser` に漏れていないか
- [ ] 下位層が上位層に依存していないか（common → browser の一方向）
- [ ] インターフェース抽出 + 手動コンストラクタ注入になっているか（重い DI 機構を持ち込んでいないか）
- [ ] 編集操作がコマンドパターンで表現され Undo/Redo と整合しているか
- [ ] UI フレームワーク依存・外部描画ライブラリ・Shadow DOM を持ち込んでいないか

### 4. テスト

- [ ] 新機能に `common` 層の単体テストがあるか
- [ ] 境界値・エラーケースのテスト
- [ ] モンキーパッチでなく IF 注入でテストしているか

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
| アーキテクチャ規約 | X件 | 🟡 |
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
- `.claude/rules/architecture.md` / `docs/plans/implementation-roadmap.md` を参照
