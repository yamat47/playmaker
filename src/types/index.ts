// Player types
export interface Player {
  id: string;
  x: number;
  y: number;
  team: 'offense' | 'defense';
  shape: 'circle' | 'square';
  color: string;
  label?: string;
}

// Line and routing types
export type LineType = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export interface LineSegment {
  points: Point[];
  type: LineType;
  branches?: LineSegment[]; // Branches from the end of this segment
}

export interface Line {
  id: string;
  playerId: string;
  segments: LineSegment[];
}

// Tool types
export type Tool = 'select' | 'player' | 'route' | 'text' | 'formation';

// Currently only using select and player, but prepared for future tools
export type CurrentTool = 'select' | 'player';

// Drawing state types
export interface RouteDrawingState {
  playerId?: string;
  lineId?: string;
  routeType: LineType;
}

// Field component types
export interface FieldProps {
  width?: number;
  height?: number;
  currentTool?: CurrentTool;
  selectedPlayerId?: string | null;
  players?: Player[];
  onPlayersChange?: (players: Player[]) => void;
  lines?: Line[];
  onLinesChange?: (lines: Line[]) => void;
  onPlayerSelect?: (playerId: string | null, player?: Player) => void;
  onPlayerUpdate?: (playerId: string, updates: Partial<Player>) => void;
  onToolChange?: (tool: CurrentTool) => void;
  onLineSelect?: (
    lineId: string | null,
    lines?: Line[],
    segmentPath?: number[],
  ) => void;
  startRouteDrawing?: RouteDrawingState | null;
  onRouteDrawingStart?: (value: RouteDrawingState | null) => void;
  onLineTypeChange?: (
    lineId: string,
    segmentPath: number[],
    newType: LineType,
  ) => void;
}

export interface FieldRef {
  changeSegmentType: (
    lineId: string,
    segmentPath: number[],
    newType: LineType,
  ) => void;
}

// Event types
export interface FieldMouseEvent {
  x: number;
  y: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}
