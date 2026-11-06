# Playmaker - Product Requirements Document

## 1. Background

Playmaker is a JavaScript library for creating and displaying American football play diagrams.
It is the "diagram-authoring core" of the commercial software for American football coaches in Japan, split out as a standalone library.

### 1.1 Why split it out as a library in a separate repository

Diagram authoring is a different kind of concern from the host side (playbook management, user management, data persistence, sharing, and so on).
The drawing and editing UX needs dense polish, while the host side centers on business flows and permission design.
Keeping both in the same repository makes it hard to focus on either concern.

Also, even if the commercial software may be rewritten or replaced in the future,
the diagram library is meant to be a core asset that stays in use for a long time.

### 1.2 Relationship to the commercial software

The commercial software that embeds Playmaker is developed in a separate repository.
This library is a "component" embedded there. It does not take on the responsibilities of the commercial software (persistence, authentication, sharing, team management, and so on).

The detailed specification of the commercial software is out of scope for this PRD and is managed in the PRD of that separate repository.

## 2. Scope

### 2.1 What this library is responsible for

- **Rendering** American football play diagrams (field, players, lines)
- The **editing UI** for play diagrams (toolbar, property panel, operations)
- The **data representation** of play diagrams (`PlayData` input and output, versioning)
- **Image export** of play diagrams (PNG)

### 2.2 Responsibilities of the commercial software (not handled by this library)

- Data persistence (saving to and loading from a server / DB)
- User authentication and permission management
- Team management and member management
- Management of the playbook as a whole (aggregating, reordering, and categorizing multiple plays)
- Sharing and comments between plays
- Access logs and view tracking
- Business flows specific to the commercial software

## 3. Target users

### 3.1 Primary users (the direct users of the library)

**The author who develops the commercial software.** The library is published to npm (MIT) and external developers can use it, but the requirements are decided by the needs of the author's commercial software. The scope is not widened to match requests from outside.

Value for the primary users:

- Writing a thin wrapper and an `onChange` handler is enough to embed play diagram creation and display in the commercial software
- The appearance can be adjusted with CSS variables to match the UI tone of the commercial software
- Play data (`PlayData`) can be stored directly in their own DB schema

### 3.2 Secondary users (end users)

**American football coaches in Japan.** People who create play diagrams for practice, games, and meetings and share them with players and staff.

The overall design of the secondary user experience is the responsibility of the commercial software. This library provides only the "draw, edit, and display a diagram" part of the experience.
Everything else (playbook structure, sharing, viewing flow, notifications, and so on) is designed on the commercial software side.

## 4. Values

### 4.1 Top priority: ease of embedding in the commercial software

The single top-priority value of this library is **ease of embedding** in the commercial software.
Polishing the end-user experience, maximizing output quality, and rigor in expressing football tactics come after this value.

Secondary principles that support "ease of embedding":

- **UI framework independence**: not tied to the technology choices of the commercial software (React / Vue / vanilla, and so on)
- **Style customization through CSS variables**: adjusting the appearance to the design system of the commercial software is done with CSS alone
- **Behavior control through hooks**: state changes are reported to the commercial software through `onChange` and similar hooks, and persistence and business logic are left to the commercial software
- **Data portability**: `PlayData` can be stored directly in the DB of the commercial software and carries versioning to prepare for future schema changes

### 4.2 Trade-off policy

The priority order above is the reference point when a feature addition or design decision is in doubt.

- When ease of embedding conflicts with end-user usability: **prioritize ease of embedding**, and adjust the end-user side in the commercial software
- When ease of embedding conflicts with the beauty of the output image: **prioritize ease of embedding**, and accept image quality within a tolerable range
- When ease of embedding conflicts with richness of tactical expression: **prioritize ease of embedding**, and deliberately narrow the range of expression

## 5. Functional requirements (overview)

The MVP provides the following feature set. API signatures, type definitions, and rendering details are managed in `docs/design.md`.

### 5.1 Field rendering

- Draw the football field as a half field (about 30 yards)
- Field zone switching: `middle` (around midfield) / `redzone` (opponent's red zone) / `own-redzone` (own red zone)
- Draw yard lines, hash marks, and yard numbers

### 5.2 Player placement

- Players can be placed on the field. Available positions are grid points at 0.5-yard steps, and both dragging and loading data snap to the grid.
  This keeps rows and columns aligned without an operation for aligning elements to each other. One diagram holds up to 64 players (a typical diagram has about 22)
- Each player is displayed with a shape (circle or square) and a label
- Color and fill (outline or solid) can be set per player and reset to the default. The color is chosen from 4 colors in the panel

### 5.3 Line drawing

Three kinds of lines can be drawn.

- **Route line (route)**: the path of a receiver / runner. Arrowhead at the end
- **Block line (block)**: the block assignment of an OL and others. T-shaped bar at the end
- **Motion line (motion)**: player movement before the snap. Dashed, with an arrowhead at the end

The kind is distinguished by the end marker and the line style, not by color. Every kind can be drawn either as a straight line or as a curve that passes through all control points.
Color and width can be set per line and reset to the default.

Each line is defined by a start point (a player), an end point, and zero or more waypoints. One diagram holds up to 128 lines, and each line up to 32 waypoints.

### 5.4 edit mode

In edit mode the following editing operations are available:

- Add / move / delete players and edit their properties (label, shape, color and fill)
- Draw / delete lines, edit their properties (color, width, interpolation), and edit waypoints
- Undo / Redo
- Load formation templates
- Switch the field zone

The toolbar and property panel are placed around the Canvas.

### 5.5 view mode

Displays the play diagram read-only. The editing UI (toolbar, property panel, drag operations, and so on) is disabled.

### 5.6 Formation templates

Load a preset formation (typical offensive and defensive formations) to place players automatically.
The commercial software can also manage custom templates and pass them in from outside to be loaded.
Typical plays with lines already drawn are also bundled and can be loaded as they are.

### 5.7 Export

The play diagram can be output as a PNG image. The export does not include the editing UI.

### 5.8 Data exchange with the commercial software

- `PlayData` can be passed at initialization
- On every editing operation, the latest `PlayData` is reported through `onChange`
- `PlayData` persisted by the commercial software can be loaded again later

## 6. Non-functional requirements

### 6.1 Browser support

Modern browsers (the latest 2 versions of Chrome / Firefox / Safari / Edge). **Desktop environments only**.

### 6.2 Performance

A typical football formation (about 22 players + 20 lines) can be drawn and operated without lag.

### 6.3 UI framework independence

Usable from React / Vue / other frameworks / vanilla JS.
The library itself does not depend on any specific framework.

### 6.4 Minimal runtime dependencies

Dependencies are kept to a range that fits naturally in the bundle of the commercial software. No dependency on a UI framework is brought in.

### 6.5 Style customization through CSS variables

The colors of the field, players, lines, and selection, and the colors and fonts of the toolbar and property panel, are provided as CSS variables (`--playmaker-*`).
The commercial software overrides the CSS variables on the element where Playmaker is placed or on one of its ancestors to match its design system.
The fonts for yard numbers and player labels are fixed to the bundled ones and cannot be overridden.

### 6.6 Data versioning

`PlayData` has a `version` field. When the schema changes in the future, a migration path that converts old versions to the current one is provided.
Because the commercial software persists and restores `PlayData`, the version management contract is kept explicit.

### 6.7 Language of the built-in UI

The toolbar and property panel are English by default. Japanese is bundled, and the commercial software chooses the language with the `locale` option at construction.
The language is fixed for the lifetime of the instance. Error messages and warnings are English regardless of the locale, because they are for developers.

## 7. Success criteria

MVP completion is judged by:

- **All of the functional requirements above (chapter 5) work as specified**
- Unit tests and integration tests pass

Evaluation in real use (whether coaches are satisfied when they actually use it, the business viability of the commercial software, and so on) is the responsibility of the PRD of the commercial software.
In the PRD for this library alone, completion is defined as **feature coverage and passing tests**.

## 8. Out of scope

The following are deliberately left out of scope.

### 8.1 Out of the feature scope

- Animation (playing back the motion of a play)
- PDF / SVG export (only PNG is provided)
- Video integration
- Drawing the LOS (Line of Scrimmage)
- Multi-select (selecting multiple players / lines at once and operating on them in bulk)
- Operations that align elements to each other (features like PowerPoint's alignment. This needs bulk movement, so it is not built. Restricting positions to grid points replaces it)
- Zoom / pan
- Copy & paste
- Keyboard shortcuts other than Undo / Redo, Delete, Esc, and committing a line drawing
- Minimum and maximum constraints on the container size (the consumer's responsibility)

### 8.2 Responsibilities of the commercial software

- Data persistence
- User authentication and team management
- Sharing with other users and view tracking
- Management of the playbook as a whole
- Comments and annotations

### 8.3 Platforms and environments left out

- **Mobile-specific UI / touch support** (PC + mouse only)
- **Accessibility (a11y) support**

### 8.4 Distribution and operation policies left out

- **Operation for external consumers** (accepting requests, compatibility promises, support). The library is published to npm and distributed under MIT, but the requirements are decided by the needs of the author's commercial software
- Distribution through a private registry or git dependencies (npm is the only channel)

## 9. Benchmark

The diagram feature of [Hudl](https://www.hudl.com/) is the reference for the diagram-authoring features.
However, the following features that Hudl provides are out of scope for this library (see chapter 8):

- Play playback animation
- Video integration
- Sharing within a team and view tracking

The axes of differentiation from Hudl (price, UX for the Japanese market, features specific to the commercial software, and so on) are handled in the PRD of the commercial software.
