---
allowed-tools: >
  Bash(git add:*), Bash(git restore:*), Bash(git commit:*),
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*),
  Bash(git push:*), Bash(git rev-parse:*), Bash(gh pr create:*),
  Bash(gh repo view:*), Bash(gh auth status:*), Bash(date:*),
  Markdown(commands/git/commit.md)
description: |
  Stage all relevant changes, create a Conventional-Commits commit
  (delegating to `commands/git/commit.md`), push a new branch, and open a
  pull request to **main** with a standardised body template.
  The command is fully non-interactive; it fails on missing data.
  `$ARGUMENTS`, if present, pre-populates the commit *subject* and the PR
  *title*.
---

## Context

- Current branch: !`git branch --show-current`
- Short status: !`git status --porcelain`
- Last three commits: !`git log --oneline -n 3`

## Task

1. **Create commit**
   - Invoke the existing commit command, forwarding `$ARGUMENTS`.

     ```bash
     claude /commands/git/commit $ARGUMENTS
     ```

   - Capture the new commit hash in `NEW_COMMIT=$(git rev-parse --short HEAD)`.

2. **Derive branch name**
   - Use the commit _type_ and _subject_ (kebab-cased, ≤40 chars) plus a
     datestamp:

     ```bash
     TYPE=$(git log -1 --format=%s | cut -d'(' -f1)
     SLUG=$(git log -1 --format=%s | sed -E 's/^[^:]+: //; s/[^a-zA-Z0-9]+/-/g; s/-+$//; s/^-+//; s/-{2,}/-/g' | cut -c1-40 | tr '[:upper:]' '[:lower:]')
     DATE=$(date +%Y%m%d)
     BRANCH="${TYPE}/${SLUG}-${DATE}"
     ```

3. **Create and push branch**

   ```bash
   git switch -c "$BRANCH"
   git push -u origin "$BRANCH"
   ```

   - Abort with error if push fails.

4. Compose pull-request metadata
   - Title: If $ARGUMENTS is non-empty, use it; otherwise use the
     commit subject verbatim.
   - Body: Fill placeholders in the static template located at
     .github/pull_request_template.md, substituting:
     - $NEW_COMMIT – short hash
     - $BRANCH – branch name
       (The template definition is provided below.)

5. Create pull request

   ```bash
   gh pr create \
   --base main \
   --head "$BRANCH" \
   --title "$TITLE" \
   --body "$(envsubst < .github/pull_request_template.md)"
   ```

6. Display result

   ```bash
   echo "Pull request opened:"
   gh pr view --web
   ```

7. Output
   - Print the PR URL on stdout for downstream tooling.
