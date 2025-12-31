export interface PlaymakerOptions {
  initialData?: PlayData;
  onChange?: (data: PlayData) => void;
  onExport?: (blob: Blob) => void;
}

export interface PlaymakerInstance {
  destroy(): void;
  getPlayData(): PlayData;
  setPlayData(data: PlayData): void;
  exportToPNG(): Promise<Blob>;
}

export interface PlayData {
  id: string;
  name: string;
  players: Player[];
  lines: Line[];
  mode: 'offense' | 'defense';
}

export interface Player {
  id: string;
  x: number;
  y: number;
  label: string;
  team: 'offense' | 'defense';
  shape: 'circle' | 'triangle' | 'x' | 'o';
}

export interface Line {
  id: string;
  type: 'route' | 'block' | 'motion' | 'blitz' | 'coverage';
  points: number[];
  playerId: string;
  style: LineStyle;
}

export interface LineStyle {
  color: string;
  thickness: number;
  dashed: boolean;
  arrowEnd: boolean;
}
