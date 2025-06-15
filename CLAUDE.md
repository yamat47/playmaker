# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Playmaker is a sports play editor/visualizer application with:
- **Rails 8.0.2 API backend** in `/rails/`
- **React 19 + TypeScript frontend** in `/react-router/`
- Canvas-based editor using Konva.js for drawing plays

## Essential Commands

### Development Setup
```bash
# Initial setup (from root)
rails/bin/setup --skip-server && cd react-router && pnpm install

# Start both servers for development
# Terminal 1 - Rails backend (port 3000):
cd rails && bin/dev

# Terminal 2 - React frontend (port 5173):
cd react-router && pnpm dev
```

### Rails Commands (run from `/rails/`)
```bash
bin/dev                    # Start Rails development server
bin/rails db:prepare       # Create and migrate database
bundle exec rubocop        # Run Ruby linter
bundle exec brakeman       # Run security analysis
bin/importmap audit        # Audit JavaScript dependencies
```

### React Commands (run from `/react-router/`)
```bash
pnpm dev                   # Start Vite development server
pnpm build                 # Build for production
pnpm lint                  # Run Biome linter
pnpm format                # Format code with Biome
pnpm typecheck             # Run TypeScript type checking
```

## Architecture Overview

### API Structure
- Rails serves API endpoints under `/api/*`
- Current endpoint: `GET /api/players` returns initial player positions
- SPA is served from `/editor/*` route via `SpaController`

### Frontend Architecture
- Single Page Application with React Router
- Main editor component at `/` uses Konva.js for canvas rendering
- State management: Local React state (no Redux/Context)
- Key data models: `Player` and `Arrow` (straight/curved) with hierarchical relationships

### Development Flow
1. Vite dev server proxies `/api/*` requests to Rails backend (port 3000)
2. Frontend fetches initial data from Rails API
3. All editing happens client-side with local state
4. No persistence layer currently implemented

### Key Files
- `/rails/config/routes.rb` - API and SPA routing
- `/rails/app/controllers/api/players_controller.rb` - Player data API
- `/react-router/src/Editor.tsx` - Main canvas editor component
- `/react-router/vite.config.ts` - Proxy configuration for API

## CI Checks

To ensure your changes will pass CI, run the following commands:

### Rails CI Checks (from project root)
```bash
cd rails && bundle exec rubocop    # Ruby linting
cd rails && bundle exec brakeman   # Security analysis
```

### React CI Checks (from project root)
```bash
cd react-router && pnpm lint       # Biome linting
cd react-router && pnpm typecheck  # TypeScript type checking
cd react-router && pnpm format     # Biome formatting check
```

### Run All CI Checks
```bash
# From project root
cd rails && bundle exec rubocop && bundle exec brakeman && cd ../react-router && pnpm lint && pnpm typecheck && pnpm format
```

## Important Notes

### File Creation
- Always ensure files end with a newline character when creating or editing files
