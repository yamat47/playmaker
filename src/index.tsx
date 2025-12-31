import { createRoot, Root } from 'react-dom/client';
import { Playmaker as PlaymakerComponent } from './Playmaker';
import type { PlaymakerOptions, PlaymakerInstance, PlayData } from './types';
import './styles/index.css';

// Re-export types for consumers
export type { PlaymakerOptions, PlaymakerInstance, PlayData };
export type { Player, Line, LineStyle } from './types';

function createEmptyPlay(): PlayData {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Play',
    players: [],
    lines: [],
    mode: 'offense',
  };
}

/**
 * Playmaker - Football Play Diagramming Tool
 *
 * @example
 * ```javascript
 * import Playmaker from 'playmaker';
 * import 'playmaker/dist/style.css';
 *
 * const instance = Playmaker.init('#container', {
 *   initialData: myPlayData,
 *   onChange: (data) => console.log('Play updated', data),
 * });
 *
 * // Later...
 * instance.destroy();
 * ```
 */
const Playmaker = {
  init(selector: string, options?: PlaymakerOptions): PlaymakerInstance {
    const container = document.querySelector(selector);
    if (!container) {
      throw new Error(`Playmaker: Container element "${selector}" not found`);
    }

    let root: Root | null = createRoot(container);
    let currentData: PlayData = options?.initialData ?? createEmptyPlay();

    const updateData = (newData: PlayData) => {
      currentData = newData;
      options?.onChange?.(newData);
    };

    root.render(
      <PlaymakerComponent
        initialData={currentData}
        onChange={updateData}
        onExport={options?.onExport}
      />
    );

    return {
      destroy() {
        if (root) {
          root.unmount();
          root = null;
        }
      },
      getPlayData(): PlayData {
        return currentData;
      },
      setPlayData(data: PlayData) {
        currentData = data;
        // Re-render with new data
        if (root) {
          root.render(
            <PlaymakerComponent
              initialData={data}
              onChange={updateData}
              onExport={options?.onExport}
            />
          );
        }
      },
      async exportToPNG(): Promise<Blob> {
        // TODO: Implement canvas export
        return new Blob();
      },
    };
  },
};

export default Playmaker;
