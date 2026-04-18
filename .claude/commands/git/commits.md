---
allowed-tools: >
  Bash(git add:*), Bash(git restore:*), Bash(git commit:*),
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*),
  Bash(git push:*), Bash(git rev-parse:*), SlashCommand(/git:commit)
description: |
  Analyze all changes, group them into logical units, and create multiple
  commits using the /git:commit command for each group.
---

## Context

- Current branch: !`git branch --show-current`
- Short status (porcelain): !`git status --porcelain`
- Staged diff: !`git diff --cached`
- Unstaged diff: !`git diff`
- Last three commits: !`git log --oneline -n 3`

## Task

1. **Analyze all changes**
   - Review all staged and unstaged changes
   - Identify logical groupings of related changes
   - Each group should represent a single, atomic change

2. **Group changes by logical units**
   - Group by feature/functionality
   - Group by file type (e.g., migrations separate from code)
   - Group by scope (e.g., model changes, controller changes, view changes)
   - List each group with:
     - Files included
     - Brief description of the change
     - Suggested commit type (feat, fix, refactor, etc.)

3. **Plan commit order**
   - Order commits logically (e.g., migrations first, then models, then controllers)
   - Ensure each commit can stand alone without breaking the build
   - Dependencies should be committed before dependent code

4. **Execute commits sequentially**
   For each commit group:
   - Stage the files for this commit using `git add <files>`
   - Compose a Conventional Commits message following the same format as `/git:commit`
   - Execute the commit using heredoc format for proper formatting. **Claude Code のクレジット表記（`🤖 Generated with [Claude Code] ...`, `Co-Authored-By: Claude ...`）は一切追加しない**（`.claude/settings.local.json` の `attribution` で無効化済み）:
     ```bash
     git commit -m "$(cat <<'EOF'
     <type>(<scope>): <subject>

     <body: why のみ。非自明な場合だけ書く>
     EOF
     )"
     ```
   - Verify the commit was created successfully
   - Continue to next group

5. **Summary**
   - List all commits created with their hashes and subjects
   - Confirm all changes have been committed

**IMPORTANT**: This command is often invoked as part of a larger workflow (e.g., `/git:create-pr`). After completing the summary, return control to the caller immediately. Do NOT treat the summary as the end of the overall workflow.

## Example Workflow

```bash
# Group 1: Model-related changes
git add app/models/user.rb spec/models/user_spec.rb
git commit -m "feat(models): ユーザーモデルに email のバリデーションを追加する"

# Group 2: Migration changes
git add db/migrate/20250123_add_fields_to_users.rb db/schema.rb
git commit -m "feat(db): ユーザーテーブルに email / phone_number カラムを追加する"

# Group 3: Controller changes
git add app/controllers/users_controller.rb spec/controllers/users_controller_spec.rb
git commit -m "feat(controllers): ユーザーの update_email アクションを追加する"
```

Extended thinking enabled – reason exhaustively before tool calls.