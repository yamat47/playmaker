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

1. **Select files** to include.
   - List each chosen path with a brief justification.
   - If unrelated changes exist, exclude them and explain why.

2. **Compose a Conventional-Commits message**
   - Format: `<type>(<scope>): <subject>` (≤ 72 chars)
   - Blank line, then multiline **body** describing _what_ and _why_.
   - Reference issues (`#123`) if relevant.
   - Add `BREAKING CHANGE:` footer when applicable.
   - If `$ARGUMENTS` provided, pre-populate **subject** with it.

3. **Execute**

   ```bash
   git add <selected-files>
   git commit -m "<subject>" -m "<body and optional footer>"
   ```

4. Verify and display:

   ```bash
   echo "Committed as $(git rev-parse --short HEAD)"
   git --no-pager log -1
   ```

5. Output the final commit hash and message.

Extended thinking enabled – reason exhaustively before tool calls.
