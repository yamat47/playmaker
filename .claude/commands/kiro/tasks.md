---
allowed-tools: TodoWrite, TodoRead, Read, Write, MultiEdit, Grep, Glob
description: Create implementation tasks for enhancement or bug fix (Stage 3 of Spec-Driven Development)
---

## Context

- Requirements: @.tmp/requirements.md
- Design document: @.tmp/design.md
- Task scope: Bug fixes and feature enhancements

## Your task

### 1. Verify prerequisites

- Check that both `.tmp/requirements.md` and `.tmp/design.md` exist
- If not, inform user to complete previous stages first

### 2. Analyze design document

- Read design to understand implementation approach
- Identify all necessary changes
- Consider testing requirements

### 3. Create Task List Document

Create `.tmp/tasks.md` with structure based on task complexity:

**For Simple Bug Fixes (< 4 hours):**
```markdown
# Bug Fix Tasks - [Bug Summary]

## Overview
- Total tasks: [number]
- Estimated time: [hours]
- Priority: [High/Medium/Low]

## Tasks

### Task 1: Reproduce and verify bug
- [ ] Set up test environment
- [ ] Reproduce bug with provided steps
- [ ] Confirm root cause in code
- **Completion criteria**: Bug reproduced, cause confirmed
- **Time**: [15-30 min]

### Task 2: Implement fix
- [ ] Apply code changes to [file_path]
- [ ] Verify fix resolves the issue
- [ ] Check for side effects
- **Completion criteria**: Bug no longer occurs
- **Time**: [1-2 hours]

### Task 3: Add/update tests
- [ ] Write test case for bug scenario
- [ ] Update existing tests if needed
- [ ] Run full test suite
- **Completion criteria**: All tests pass
- **Time**: [30 min - 1 hour]

### Task 4: Final verification
- [ ] Manual testing in development
- [ ] Code review checklist
- [ ] Update documentation if needed
- **Completion criteria**: Ready for PR
- **Time**: [15-30 min]
```

**For Feature Enhancements (1-3 days):**
```markdown
# Enhancement Tasks - [Feature Name]

## Overview
- Total tasks: [number]
- Estimated time: [days]
- Complexity: [Low/Medium/High]

## Phase 1: Preparation

### Task 1.1: Code analysis and setup
- [ ] Review existing implementation in [files]
- [ ] Set up development branch
- [ ] Identify integration points
- **Completion criteria**: Ready to implement
- **Dependencies**: None
- **Time**: [1-2 hours]

## Phase 2: Implementation

### Task 2.1: Model layer changes
- [ ] Update/add model in `app/models/[model].rb`
- [ ] Add validations and associations
- [ ] Write model specs
- **Completion criteria**: Model tests pass
- **Dependencies**: Task 1.1
- **Time**: [2-3 hours]

### Task 2.2: Controller layer changes
- [ ] Update controller in `app/controllers/[path].rb`
- [ ] Add/modify actions
- [ ] Handle error cases
- [ ] Write request specs
- **Completion criteria**: Controller tests pass
- **Dependencies**: Task 2.1
- **Time**: [2-3 hours]

### Task 2.3: View layer changes
- [ ] Update views in `app/views/[path]/`
- [ ] Add/modify Stimulus controllers if needed
- [ ] Ensure responsive design
- **Completion criteria**: UI works as designed
- **Dependencies**: Task 2.2
- **Time**: [1-2 hours]

### Task 2.4: Database changes (if applicable)
- [ ] Create migration file
- [ ] Run migration locally
- [ ] Update seeds if needed
- **Completion criteria**: Schema updated successfully
- **Dependencies**: Task 2.1
- **Time**: [30 min]

## Phase 3: Testing & Polish

### Task 3.1: Integration testing
- [ ] Write feature specs
- [ ] Test happy paths
- [ ] Test edge cases
- [ ] Test error scenarios
- **Completion criteria**: All scenarios covered
- **Dependencies**: Phase 2 complete
- **Time**: [2-3 hours]

### Task 3.2: Code quality
- [ ] Run RuboCop and fix issues
- [ ] Run Brakeman security scan
- [ ] Check test coverage
- [ ] Refactor if needed
- **Completion criteria**: All checks pass
- **Dependencies**: Task 3.1
- **Time**: [1 hour]

### Task 3.3: Documentation
- [ ] Update code comments
- [ ] Update README if needed
- [ ] Document any new environment variables
- **Completion criteria**: Documentation complete
- **Dependencies**: Task 3.2
- **Time**: [30 min]

## Implementation Order

1. Complete Phase 1 first
2. Phase 2 tasks can be done iteratively
3. Phase 3 must be done after Phase 2

## Verification Checklist

Before marking complete:
- [ ] All tests pass (`bundle exec rspec`)
- [ ] Linting passes (`bundle exec rubocop`)
- [ ] Security scan clean (`bundle exec brakeman`)
- [ ] Manual testing completed
- [ ] Code follows project conventions
```

### 4. Register main tasks in TodoWrite

Extract high-level tasks (Phase level) and register them using TodoWrite tool:
- Set appropriate priorities based on dependencies
- Include time estimates in task descriptions

### 5. Add quick reference section

Always include at the end:
```markdown
## Quick Commands Reference

# Run tests
bundle exec rspec [spec file]

# Lint code
bundle exec rubocop -a

# Security check
bundle exec brakeman

# Start server
bin/dev

# Database commands
bin/rails db:migrate
bin/rails db:rollback
```

### 6. Present to user

Show the task list and:
- Explain the breakdown rationale
- Highlight critical path
- Confirm readiness to start implementation
- Suggest starting with the first task

## Important Notes

- Keep tasks small and measurable
- Each task should be a logical commit
- Include testing throughout, not just at end
- Consider reviewer's perspective
- Tasks should be completable without context switching

think hard