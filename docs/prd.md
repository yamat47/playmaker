# PRD: Web-Based 11-Player Football Play Diagramming Tool

## Overview

This browser-based application enables American-football coaches to design complex 11-player offensive and defensive play diagrams on an interactive digital whiteboard. It is distributed as an npm package that can be embedded into external applications (primarily Ruby on Rails) via a simple initialization API. The package emphasizes portability through PNG export, delivers a feature-rich yet user-friendly interface, and avoids platform lock-in.

## Target Users

    •	Primary: High-school and college coaches (head, coordinators, position coaches, analysts) responsible for play design.
    •	Use cases: Creating offensive plays, defensive schemes, scout-team cards, weekly game plans, and instructional materials.
    •	Secondary: Football educators or illustrators producing diagrams for clinics, textbooks, or media.

## Core Features

### Interactive Field Diagram & Player Setup

    •	Realistic football-field canvas (grid or turf with yard lines).
    •	Drag-and-drop placement of up to 22 player icons, each labeled (e.g., QB, MLB).
    •	Distinct visual styles for offense and defense, with formation-shift grouping.

### Player Position Labeling & Customization

    •	Editable text labels and icon shapes (circle/triangle, X/O) with color and size options.
    •	Library of common position abbreviations.

### Offensive & Defensive Mode Toggle

    •	Context-sensitive toolsets for offense (routes, blocking) and defense (coverages, blitzes).
    •	Visual focus indicator highlights the side currently being edited.

### Run/Pass Play Selection (Offense)

    •	Run mode: emphasizes ball-carrier path and blocking lines.
    •	Pass mode: emphasizes receiver routes, QB dropback, and defensive coverages.

### Drawing Tools for Assignments

    •	Route Arrows: straight or curved, with templates (go, post, out, drag, etc.).
    •	Blocking Lines: specialized endpoint markers indicating blocks.
    •	Motion & Handoff Indicators: dashed lines or color variants.
    •	Coverage & Blitz Tools: translucent zone shapes, man-coverage trails, blitz arrows.
    •	Line Customization: selectable endpoints, styles, thickness, and colors.
    •	Automatic Drawing Aids (future): quick-add stencils for common patterns.

### Editing & Interaction Controls

    •	Undo/redo history.
    •	Drag handles on all elements for refinement.
    •	Smooth zoom / pan; optional snap-to-grid and alignment guides.
    •	Layer visibility toggles (e.g., hide defense).
    •	Contextual menus (e.g., flip play, copy/paste routes).
    •	Direct manipulation principle: minimal data entry.

### Export to PNG

    •	One-click export of the diagram exactly as displayed, without metadata overlays.
    •	Clean PNG ensures easy sharing, printing, and ownership.

## Distribution & Integration

### Package Distribution

    •	Distributed as an npm package (ES Module / UMD formats).
    •	TypeScript type definitions included.
    •	CSS file provided separately (`playmaker/dist/style.css`).

### Initialization API

DOM element-based mounting for full application:

```javascript
import Playmaker from 'playmaker';
import 'playmaker/dist/style.css';

// Initialize
const instance = Playmaker.init('#container', {
  // options (see Public API section)
});

// Cleanup
instance.destroy();
```

### Primary Integration Target

    •	Ruby on Rails applications.
    •	Import via Rails Asset Pipeline or JavaScript bundler.

### Development Preview

    •	`demo/` directory contains demo page that imports built library.
    •	Demo page uses library the same way as end users, serving as integration test.

## Public API

### Initialization

    •	`Playmaker.init(selector: string, options?: PlaymakerOptions): PlaymakerInstance`
        - Mounts full application to specified DOM element.
        - Accepts optional initial data and callback configuration.

### Instance Methods

    •	`instance.destroy()` - Unmounts application and performs cleanup.
    •	`instance.getPlayData()` - Returns current play data as JSON.
    •	`instance.setPlayData(data)` - Sets play data.
    •	`instance.exportToPNG()` - Exports diagram as PNG image.

### Options

    •	`initialData?: PlayData` - Initial play data.
    •	`onChange?: (data: PlayData) => void` - Callback on data change.
    •	`onExport?: (blob: Blob) => void` - Callback on export.

### Types

    •	All type definitions exported for TypeScript support.

## Non-Functional Requirements

Category Requirements
Platform & Browser Modern desktop browsers (Chrome, Firefox, Safari, Edge); no plugins; ≥ 13″ screens; mouse/trackpad input.
Performance Instantaneous dragging and drawing; handles 22 players and numerous lines without lag (HTML5 Canvas/SVG optimizations).
Usability Intuitive icons/tooltips; sketch a basic play within minutes; optional help overlay.
Visual Clarity High-resolution vector or canvas rendering; color-blind-friendly palette; consistent offensive/defensive colors.
Reliability Stable under extended use; graceful error handling; optional local auto-save.
Security Served over HTTPS; minimal sensitive data; vetted third-party libraries.
Scalability Modular architecture for future features (e.g., 7-on-7, Canadian football).
Accessibility Keyboard shortcuts; high-contrast mode; scalable text; partial ARIA compliance.
Distribution npm package distribution; ES Module / UMD formats; TypeScript type definitions included; CSS provided separately.
Development Development server preview within repository; Hot Module Replacement support.

## Out of Scope

    •	Mobile/touch optimization for phones.
    •	Real-time animation or simulation of plays.
    •	Video integration or film analysis.
    •	Cloud-based playbook database, team management, or multi-user collaboration.
    •	Special-teams-specific tools and non-11-player scenarios.
    •	Advanced diagramming (formation templates, batch printing, AI suggestions).
    •	Export formats beyond PNG.
    •	Rich text annotation beyond basic labels.
    •	Direct React component export (DOM mounting API only).
    •	Server-side rendering (SSR) support.

## Notes for Implementation

    1.	Technology Stack:
        - Core: React 18 + TypeScript + Konva.js for canvas rendering.
        - Build: Vite in library mode (ES Module + UMD output).
        - State: Zustand for internal state management.
        - Styling: Tailwind CSS, distributed as separate CSS file.
    2.	Distribution Format:
        - npm package with ES Module and UMD builds.
        - TypeScript declarations included.
        - CSS file provided separately (`playmaker/dist/style.css`).
    3.	Initialization API:
        - `Playmaker.init(selector, options)` mounts full application to specified DOM element.
        - `instance.destroy()` for cleanup.
        - Data import/export methods for integration with host application.
    4.	Development Workflow:
        - `demo/` directory contains demo page that imports built library.
        - `pnpm dev` for library development, `pnpm demo` for demo page.
        - Demo page serves as integration test, using library same way as end users.
    5.	Diagram Layering: Field base → zone shapes → assignment lines → player icons; selected elements rendered on top.
    6.	State Management: Command pattern or comparable stack for undo/redo; JSON data model for players and lines.
    7.	Drawing Interaction: Click-and-drag for lines; preset route shapes selectable.
    8.	Mode Toggles: Offense/defense and run/pass implemented as UI flags influencing default colors and available tools.
    9.	PNG Export: Canvas toDataURL(), omitting selection handles; default full-field scale.
    10.	User Testing: Early coach feedback sessions to refine nomenclature, icons, and workflow.
    11.	Future Extensibility: JSON play model allows later cloud save, formation templates, or multi-coach collaboration.
    12.	Competitive Focus: Prioritize speed, clarity, and content ownership—key differentiators from Hudl, Football Play Card, and Pro Quick Draw.
