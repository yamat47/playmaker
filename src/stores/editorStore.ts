import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Player, Line, CurrentTool, RouteDrawingState } from '../types';

interface EditorState {
  // State
  players: Player[];
  lines: Line[];
  selectedElementId: string | null;
  selectedElementType: 'player' | 'line' | null;
  selectedSegmentPath: number[] | null;
  currentTool: CurrentTool;
  startRouteDrawing: RouteDrawingState | null;

  // Player actions
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  setPlayers: (players: Player[]) => void;

  // Line actions
  addLine: (line: Line) => void;
  updateLine: (id: string, updates: Partial<Line>) => void;
  deleteLine: (id: string) => void;
  setLines: (lines: Line[]) => void;

  // Selection actions
  selectElement: (
    id: string | null,
    type: 'player' | 'line' | null,
    segmentPath?: number[],
  ) => void;
  clearSelection: () => void;
  getSelectedPlayer: () => Player | null;
  getSelectedLine: () => Line | null;

  // Tool actions
  setTool: (tool: CurrentTool) => void;

  // Route drawing actions
  startDrawingRoute: (routeDrawing: RouteDrawingState) => void;
  stopDrawingRoute: () => void;

  // Bulk operations
  deleteSelected: () => void;
  deleteAll: () => void;
}

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      // Initial state
      players: [],
      lines: [],
      selectedElementId: null,
      selectedElementType: null,
      selectedSegmentPath: null,
      currentTool: 'select',
      startRouteDrawing: null,

      // Player actions
      addPlayer: (player) => {
        set((state) => ({
          players: [...state.players, player],
        }));
      },

      updatePlayer: (id, updates) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),

      deletePlayer: (id) =>
        set((state) => ({
          players: state.players.filter((p) => p.id !== id),
          lines: state.lines.filter((l) => l.playerId !== id),
          selectedElementId:
            state.selectedElementId === id ? null : state.selectedElementId,
          selectedElementType:
            state.selectedElementId === id ? null : state.selectedElementType,
        })),

      setPlayers: (players) => set({ players }),

      // Line actions
      addLine: (line) =>
        set((state) => ({
          lines: [...state.lines, line],
        })),

      updateLine: (id, updates) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === id ? { ...l, ...updates } : l,
          ),
        })),

      deleteLine: (id) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.id !== id),
          selectedElementId:
            state.selectedElementId === id ? null : state.selectedElementId,
          selectedElementType:
            state.selectedElementId === id ? null : state.selectedElementType,
        })),

      setLines: (lines) => set({ lines }),

      // Selection actions
      selectElement: (id, type, segmentPath) => {
        set({
          selectedElementId: id,
          selectedElementType: type,
          selectedSegmentPath: segmentPath,
        });
      },

      clearSelection: () =>
        set({
          selectedElementId: null,
          selectedElementType: null,
          selectedSegmentPath: null,
        }),

      getSelectedPlayer: () => {
        const state = get();
        if (state.selectedElementType !== 'player' || !state.selectedElementId)
          return null;
        return (
          state.players.find((p) => p.id === state.selectedElementId) || null
        );
      },

      getSelectedLine: () => {
        const state = get();
        if (state.selectedElementType !== 'line' || !state.selectedElementId)
          return null;
        return (
          state.lines.find((l) => l.id === state.selectedElementId) || null
        );
      },

      // Tool actions
      setTool: (tool) => set({ currentTool: tool }),

      // Route drawing actions
      startDrawingRoute: (routeDrawing) =>
        set({ startRouteDrawing: routeDrawing }),

      stopDrawingRoute: () => set({ startRouteDrawing: null }),

      // Bulk operations
      deleteSelected: () => {
        const state = get();
        if (!state.selectedElementId) return;

        if (state.selectedElementType === 'player') {
          get().deletePlayer(state.selectedElementId);
        } else if (state.selectedElementType === 'line') {
          get().deleteLine(state.selectedElementId);
        }
      },

      deleteAll: () =>
        set({
          players: [],
          lines: [],
          selectedElementId: null,
          selectedElementType: null,
          selectedSegmentPath: null,
        }),
    }),
    {
      name: 'editor-store',
    },
  ),
);
