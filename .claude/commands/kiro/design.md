---
allowed-tools: TodoWrite, TodoRead, Read, Write, MultiEdit, Grep, Glob, Task
description: Create technical design for enhancement or bug fix (Stage 2 of Spec-Driven Development)
---

## Context

- Requirements document: @.tmp/requirements.md
- Existing Rails codebase with established patterns

## Your task

### 1. Verify prerequisites

- Check that `.tmp/requirements.md` exists
- If not, inform user to run `/requirements` first

### 2. Analyze requirements and existing code

- Read requirements document thoroughly
- Study existing implementation patterns
- Identify integration points and dependencies

### 3. Create Design Document

Create `.tmp/design.md` with structure based on task type:

**For Bug Fixes:**
```markdown
# Bug Fix Design Document - [Bug Summary]

## 1. Fix Strategy

### 1.1 Root Cause
- Cause: [Cause identified through code analysis]
- Location: [file_path:line_number]

### 1.2 Fix Approach
- Selected fix method: [Approach description]
- Reason for not choosing alternatives: [Reason]

## 2. Changes

### 2.1 Code Changes
```ruby
# Before
[Current code]

# After
[Fixed code]
```

### 2.2 Impact Scope
- Direct impact: [Behavior changes from fix]
- Indirect impact: [Impact on other features]

## 3. Test Plan

### 3.1 Fix Verification Tests
- [ ] Verify bug no longer reproduces
- [ ] Verify normal operation

### 3.2 Regression Tests
- [ ] [Related feature 1 test]
- [ ] [Related feature 2 test]

## 4. Rollback Plan
- Rollback procedure if issues occur
```

**For Enhancements:**
```markdown
# Enhancement Design Document - [Feature Name]

## 1. Design Overview

### 1.1 Enhancement Overview
[Visualize enhancement with ASCII diagram or text]

### 1.2 Integration with Existing Code
- Extension points: [Where to extend]
- Reusable components: [Existing parts to leverage]

## 2. Detailed Design

### 2.1 Model Layer Changes

#### Models to modify/add
```ruby
# app/models/[model_name].rb
class ModelName < ApplicationRecord
  # New methods and validations to add
end
```

### 2.2 Controller Layer Changes

#### Controllers to modify/add
```ruby
# app/controllers/[namespace]/[controller_name].rb
class Namespace::ControllerName < ApplicationController
  # New actions to add
end
```

### 2.3 View Layer Changes

#### Views to modify/add
- `app/views/[path]/[view].html.haml`
- Main changes: [UI/UX changes]

### 2.4 JavaScript/Stimulus Changes

```javascript
// app/javascript/controllers/[name]_controller.js
// Interactions to add
```

## 3. Database Changes (if applicable)

### 3.1 Migration
```ruby
class AddFeatureToModel < ActiveRecord::Migration[8.0]
  def change
    # Migration content
  end
end
```

## 4. Impact on Existing Code

### 4.1 Existing Files Requiring Changes
- [file_path] - [Reason for change]
- [file_path] - [Reason for change]

### 4.2 Maintaining Compatibility
- [ ] Existing API backward compatibility
- [ ] Database schema compatibility

## 5. Security Considerations
- Authentication/authorization changes: [If any]
- Data validation: [Validations to add]

## 6. Performance Considerations
- Query optimization: [If needed]
- Caching strategy: [If needed]

## 7. Test Strategy

### 7.1 Unit Tests
- [ ] Model specs: `spec/models/[model]_spec.rb`
- [ ] Controller specs: `spec/requests/[path]_spec.rb`

### 7.2 Integration Tests
- [ ] Feature specs: `spec/features/[feature]_spec.rb`

## 8. Deployment Considerations
- Environment variables to add: [If needed]
- Deployment order: [If special steps needed]
```

### 4. Add existing patterns section

Always include:
```markdown
## Leveraging Existing Patterns
- Reference implementation: [Similar feature file paths]
- Coding conventions to follow: [Project conventions]
- Concerns to use: [Applicable ones]
```

### 5. Update TODO

Use TodoWrite to add task:
- Bug fix: "Bug fix design complete"
- Enhancement: "Enhancement design complete"

### 6. Present to user

Show the design document and:
- Explain technical decisions
- Highlight risks or concerns
- Get approval before implementation

## Important Notes

- Design should follow existing Rails patterns
- Reference specific files and line numbers
- Keep changes minimal and focused
- Consider testing from the start
- Document any technical debt that needs addressing

think hard