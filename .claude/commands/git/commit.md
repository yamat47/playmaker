---
allowed-tools: >
  Bash(git add:*), Bash(git restore:*), Bash(git commit:*),
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*),
  Bash(git push:*), Bash(git rev-parse:*)
description: |
  Stage appropriate changes, compose a Conventional-Commits message, and
  create (then display) the resulting commit.
  If $ARGUMENTS is non-empty it is treated as the commit **subject**.
---

## Context

- Current branch: !`git branch --show-current`
- Short status (porcelain): !`git status --porcelain`
- Staged diff: !`git diff --cached`
- Unstaged diff: !`git diff`
- Last three commits: !`git log --oneline -n 3`

## Task

1. **Check if specific files are provided**
   - If `$FILES` environment variable is set, use those files directly
   - Otherwise, analyze all changes and select appropriate files

2. **Select files** to include (if not pre-selected).
   - List each chosen path with a brief justification.
   - If unrelated changes exist, exclude them and explain why.

3. **Compose a Conventional-Commits message**
   - Format: `<type>(<scope>): <subject>` (≤ 72 chars)
   - **Language**: Use Japanese for subject and body, but keep Conventional Commits prefix in English (e.g., `feat:`, `fix:`, `refactor:`)
   - Subject は能動態・現在形で書く（「実装する」「追加する」）
   - **Body は Why のみ、非自明な場合だけ書く**。Subject と diff で What は伝わる。ファイル列挙や実装詳細を書いてはいけない。Why が自明（機械的な置き換え、明白な typo 修正、トラッキング issue に紐づく小さな step）なら body を省略して subject のみでコミットする
   - Reference issues (`#123`) if relevant.
   - Add `BREAKING CHANGE:` footer when applicable.
   - If `$ARGUMENTS` provided, pre-populate **subject** with it.
   - **Claude Code のクレジット表記は付けない**。`🤖 Generated with [Claude Code] ...` や `Co-Authored-By: Claude ...` のトレーラーは一切追加しない（`.claude/settings.local.json` の `attribution` で無効化済み）。

   **Commit Granularity Guidelines**:
   - Keep commits atomic and focused on a single logical change
   - Typical commit patterns in this project:
     - Single feature addition (e.g., "AmazonギフトカードのCSVインポートに関する詳細ページを追加した。")
     - Database/model changes (e.g., "AmazonギフトカードとCSVインポート情報とを紐づけられるようにした。")
     - Configuration updates (e.g., "プロジェクトで利用されそうな単語を許可リストに追加した。")
     - UI/view changes separate from backend logic
     - Test improvements as separate commits
   - Avoid mixing different types of changes in one commit

4. **Execute**

   ```bash
   git add <selected-files>

   # Use heredoc for proper formatting
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <subject>

   <body: why のみ。非自明な場合だけ書く>
   EOF
   )"
   ```

   **Important**: Always use heredoc format to ensure proper formatting and newlines.

5. Verify and display:

   ```bash
   git log -1
   ```

6. Output the final commit hash and message.

Extended thinking enabled – reason exhaustively before tool calls.
