---
description: Vitest test conventions. Verify editing through specification tests, and limit unit tests to the contract of a module.
paths:
  - "library/src/**/*.test.ts"
  - "library/src/test-support/**"
---

# Test conventions

Tests attach to the behavior the consumer sees, not to the parts of the implementation. This lets the internal boundaries change without rewriting the tests.

## Specification tests

Verify editing behavior with specification tests that use `PlaySession` and `IEditorController` as the boundary.

- Put them in `src/common/specs/<feature>.test.ts`. Use one file per feature, not one per source file
- The entry point is `openPlay` in `src/test-support/play-driver.ts`. Operate in yard coordinates (`yd(lateral, downfield)`), and
  use `click`, `drag`, and `startLine` for clicks, drags, and starting a drawing. Call `editor` directly for tool switching, Undo, and edits from the panel
- Observe only session reads (`getPlayData()`, `getSnapshot()`, `fieldZone`) and the return value of `loadFormation`,
  view state (`editor.getViewState()`, `editor.getFrame()`, `editor.getSelectedPlayer()`, `editor.getSelectedLine()`),
  and notifications (`onChange`, `notified`, `session.onDidChange`, `session.onDidReset`, `editor.onDidRequestLabelEdit`)
- Create a `PlaySession` directly without `openPlay` only when verifying the unsubscribed state
- Do not import internal modules such as commands, interaction, preview, or PlayModel.
  Types used to build a diagram and public constants such as `MAX_PLAYERS` are fine
- PlaySession and IEditorController stay unpublished. Freezing a gesture-level API with compatibility guarantees has no benefit for the current consumers

## Browser tests

Verify the wiring of `new Playmaker(container)` (DOM, pointer, keys, theme variables) by running Chromium through Vitest Browser Mode.

- Put them in `src/playmaker.browser.test.ts`. Verify the editing behavior itself with specification tests; here, verify only
  that UI operations reach the diagram, plus DOM assembly and teardown. Keep it at 10 to 25 tests
- Operate through `page` and `userEvent` from `vitest/browser`, and find elements by role and name.
  Pass positions inside the canvas as px from the top-left corner of the canvas
- Observe only the public API (`getPlayData()`, `fieldZone`, `onChange`) and the DOM placed in the container

## Unit tests

Put `*.test.ts` next to the source only where the module's contract can be stated.

- The targets are bezier, polyline, the field coordinate transforms, hit-test, keymap, the base Event and lifecycle,
  PlayData normalization and `migratePlayData`, and the presets
- Verify numeric computations that cannot be observed from the public entry points with unit tests
- Do not re-verify behavior covered by specification tests with unit tests of internal modules.
  This section takes precedence over "add unit tests to extracted functions" in the `typescript-idioms` skill
- Verify type guards such as `isPlayerShape` through the normalization tests that use them, not on their own.
  A value check shows up as normalization falling back to the default

## Style

- Vitest runs `src/**/*.test.ts` in the node environment and `src/**/*.browser.test.ts` in Chromium. Do not use globals; import `describe` `it` `expect` `vi` from `vitest`
- Name `describe` after the feature, or after the module for a unit test. Name `it` according to the `writing-conventions` skill
  (for example, `it("passes the moved diagram exactly once when a player is dragged and released")`)
- One `it` verifies one behavior. Separate the arrange, act, and assert stages with blank lines, and do not write comments such as `// Arrange`
- Do not write which coverage branch a test exercises in its name or comments. Write the behavior
- Create spies with `vi.fn()` and verify them with `toHaveBeenCalledOnce` or `toHaveBeenCalledExactlyOnceWith`.
  Do not monkey-patch or replace modules (`vi.mock`)
- Put parts shared by multiple tests in `src/test-support/`. It is excluded from coverage and build, and
  `tsconfig.test.json` type-checks it together with the tests

## Running

- `make test` (all node tests, with the coverage gate), `make test FILE=<file>` (one file, no gate),
  `make test-watch` (no coverage)
- `make test-browser` (browser tests). In CI it runs as a separate job
- Do not verify appearance (colors, line shapes, text) with tests; do a visual check in the demo (`run-demo` skill)

## Coverage (100% gate on the common layer)

- Apply the threshold only to `src/common/**`, with all 4 metrics at 100% and `perFile: true`.
  `browser/` `playmaker.ts` `index.ts` are measured but do not fail the gate. The configuration lives in one place, `test.coverage` in `vite.config.ts`
- The gate is part of `make test`, so local runs and CI make the same judgment
- When it fails, look at "Uncovered Line #s" in the `text` reporter and do one of the following
  1. If the behavior is reachable from the consumer, add a specification test or a unit test
  2. If the code is unreachable from specification tests and from the consumer, delete it
  3. Only for unreachable defensive code, such as guards for `noUncheckedIndexedAccess`,
     exclude it with `/* v8 ignore start -- <Why> */ … /* v8 ignore stop */`. Why is required and is approved in PR review
- To trace uncovered lines locally, open `coverage/index.html` (already gitignored)

## What we do not do

- Do not adopt visual regression testing (VRT) that compares screenshots
