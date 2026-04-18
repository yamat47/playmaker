---
allowed-tools: >
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*),
  Bash(git switch:*), Bash(git push:*), Bash(git add:*), Bash(git commit:*),
  Bash(git restore:*), Bash(git rev-parse:*), Bash(date:*),
  Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr list:*),
  Bash(./scripts/dcc exec:*),
  Read, Write(.tmp/pr-body.md), Agent
description: |
  Create multiple Conventional-Commits commits,
  push a new feature branch, and open a pull request to **main** with a
  comprehensive body based on the PR template.
  The command is fully non-interactive and automatic.
---

## Context

- Current branch: !`git branch --show-current`
- Short status: !`git status --porcelain`
- Last three commits: !`git log --oneline -n 3`

## Task

Read the `create-pr` skill at `.claude/skills/create-pr/SKILL.md` and execute its full workflow.

**CRITICAL**: Execute ALL steps from start to finish without stopping.
Do NOT wait for user confirmation between steps. Only stop if an unrecoverable error occurs.
