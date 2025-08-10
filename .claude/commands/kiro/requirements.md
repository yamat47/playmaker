---
allowed-tools: TodoWrite, TodoRead, Read, Write, MultiEdit, Bash(mkdir:*), Grep, Glob, Task
description: Analyze requirements for enhancement or bug fix (Stage 1 of Spec-Driven Development)
---

## Context

- Task description: $ARGUMENTS
- Existing codebase: OneCareer Report Rails application

## Your task

### 1. Create directory

- Create `.tmp` directory if it doesn't exist

### 2. Understand existing implementation

Before analyzing new requirements:
- Search and read relevant existing code
- Understand current functionality
- Identify integration points
- Check for similar patterns in codebase

### 3. Analyze the task

Based on task type, extract:

**For Bug Fixes:**
- Bug symptoms and reproduction steps
- Root cause analysis approach
- Expected correct behavior
- Affected components

**For Enhancements:**
- Current functionality gaps
- Desired improvements
- User impact
- Technical constraints

### 4. Create Requirements Document

Create `.tmp/requirements.md` with structure adapted to task type:

**For Bug Fixes:**
```markdown
# Bug Fix Requirements - [Bug Summary]

## 1. Issue Overview
- Environment: [Production/Development]
- Affected scope: [Affected users/features]
- Priority: [Urgent/High/Medium/Low]

## 2. Symptoms
### 2.1 Reproduction Steps
1. [Step 1]
2. [Step 2]

### 2.2 Expected Behavior
- [Description of correct behavior]

### 2.3 Actual Behavior
- [Description of bug behavior]

## 3. Root Cause Analysis
- Suspected cause: [Cause inferred from code analysis]
- Related files: [file_path:line_number]

## 4. Fix Approach
- [ ] [Fix approach 1]
- [ ] [Fix approach 2 if needed]

## 5. Test Plan
- [ ] Bug reproduction test
- [ ] Post-fix verification
- [ ] Regression test scope
```

**For Enhancements:**
```markdown
# Enhancement Requirements - [Feature Name]

## 1. Background and Purpose
- Current challenges: [Issues with existing functionality]
- Improvement goals: [What we want to achieve]

## 2. Enhancement Details
### 2.1 Scope of Changes
- Target features: [Features to be modified]
- Related files: 
  - [file_path:line_number - role]
  - [file_path:line_number - role]

### 2.2 Functional Changes
- [ ] [Change 1: Specific change details]
- [ ] [Change 2: Specific change details]

### 2.3 UI/UX Changes (if applicable)
- [ ] [Screen/interaction changes]

## 3. Technical Requirements
### 3.1 Technologies Used
- Existing: [Currently used technologies]
- New: [Technologies to be introduced]

### 3.2 Compatibility
- [ ] Maintain compatibility with existing data
- [ ] API backward compatibility

## 4. Success Criteria
- [ ] [Measurable completion criterion 1]
- [ ] [Measurable completion criterion 2]

## 5. Risks and Mitigations
- Risk: [Identified risks]
- Mitigation: [Risk mitigation strategies]
```

### 5. Add implementation notes

Include section for:
- Existing code patterns to follow
- Similar implementations in codebase
- Potential impacts on other features

### 6. Create TODO entry

Use TodoWrite to add task based on type:
- Bug fix: "Bug fix requirements analysis complete"
- Enhancement: "Enhancement requirements definition complete"

### 7. Present to user

Show the requirements and:
- Highlight critical findings from code analysis
- Confirm understanding of the issue/enhancement
- Get approval for proposed approach

## Important Notes

- Focus on existing code understanding
- Keep documentation proportional to task size
- Include specific file/line references
- Consider impact on existing tests
- Document any technical debt encountered

think hard
