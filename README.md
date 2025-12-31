# Playmaker

Web-based 11-player football play diagramming tool distributed as an npm package.

## Features

- Interactive football field canvas with drag-and-drop player placement
- Route drawing tools for offensive plays
- Coverage and blitz visualization for defensive schemes
- PNG export for sharing and printing
- TypeScript support with full type definitions

## Installation

```bash
npm install playmaker
# or
pnpm add playmaker
```

## Usage

```javascript
import Playmaker from 'playmaker';
import 'playmaker/dist/style.css';

// Initialize
const instance = Playmaker.init('#container', {
  onChange: (data) => {
    console.log('Play updated:', data);
  },
  onExport: (blob) => {
    // Handle PNG export
  },
});

// Get current play data
const data = instance.getPlayData();

// Set play data
instance.setPlayData(newData);

// Export to PNG
const blob = await instance.exportToPNG();

// Cleanup
instance.destroy();
```

## Development

### Requirements

- Node.js >= 18
- pnpm

### Setup

```bash
pnpm install
```

### Commands

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Build library in watch mode                   |
| `pnpm demo`         | Start demo page (requires `pnpm build` first) |
| `pnpm build`        | Build the library                             |
| `pnpm typecheck`    | Run TypeScript type checking                  |
| `pnpm lint`         | Run ESLint                                    |
| `pnpm lint:fix`     | Run ESLint with auto-fix                      |
| `pnpm test`         | Run tests in watch mode                       |
| `pnpm test:run`     | Run tests once                                |
| `pnpm format`       | Format code with Prettier                     |
| `pnpm format:check` | Check code formatting                         |

### Demo

To run the demo page:

```bash
pnpm build
pnpm demo
```

## Tech Stack

- React 18/19
- TypeScript
- Konva.js (react-konva)
- Zustand (state management)
- Tailwind CSS
- Vite (library mode)
- Vitest (testing)

## License

MIT
