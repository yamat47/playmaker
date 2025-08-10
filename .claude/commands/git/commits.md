---
allowed-tools: >
  Bash(git add:*), Bash(git restore:*), Bash(git commit:*),
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*),
  Bash(git push:*), Bash(git rev-parse:*), Task(/commands/git/commit:*)
description: |
  Analyze all changes, group them into logical units, and create multiple
  commits using the commit.md command for each group.
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
   - Set FILES environment variable with the files for this commit
   - Call `/commands/git/commit` with appropriate subject
   - Verify the commit was created successfully
   - Continue to next group

5. **Summary**
   - List all commits created with their hashes and subjects
   - Confirm all changes have been committed

## Example Workflow

```bash
# For a group of model-related changes:
FILES="app/models/user.rb spec/models/user_spec.rb" /commands/git/commit "feat(models): ユーザーモデルに新しいバリデーションを追加"

# For a group of migration changes:
FILES="db/migrate/20250123_add_fields_to_users.rb db/schema.rb" /commands/git/commit "feat(db): ユーザーテーブルに新しいフィールドを追加"

# For a group of controller changes:
FILES="app/controllers/users_controller.rb spec/controllers/users_controller_spec.rb" /commands/git/commit "feat(controllers): ユーザーコントローラーに新しいアクションを追加"
```

Extended thinking enabled – reason exhaustively before tool calls.
