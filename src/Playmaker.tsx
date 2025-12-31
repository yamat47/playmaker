import { useEffect, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import { usePlayStore } from './store/usePlayStore';
import type { PlayData } from './types';

interface PlaymakerProps {
  initialData: PlayData;
  onChange?: (data: PlayData) => void;
  onExport?: (blob: Blob) => void;
}

export function Playmaker({ initialData, onChange }: PlaymakerProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const { play, setPlay } = usePlayStore();

  // Initialize store with initial data
  useEffect(() => {
    setPlay(initialData);
  }, [initialData, setPlay]);

  // Notify parent of changes
  useEffect(() => {
    if (play && onChange) {
      onChange(play);
    }
  }, [play, onChange]);

  return (
    <div className="pm-w-full pm-h-full pm-min-h-96 pm-bg-green-700">
      <Stage ref={stageRef} width={800} height={600}>
        <Layer>
          {/* Field background */}
          <Rect x={0} y={0} width={800} height={600} fill="#2d5a27" />
        </Layer>
      </Stage>
    </div>
  );
}
