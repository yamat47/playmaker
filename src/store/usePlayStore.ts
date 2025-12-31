import { create } from 'zustand';
import type { PlayData, Player, Line } from '../types';

interface PlayState {
  play: PlayData | null;
  selectedPlayerId: string | null;
  selectedLineId: string | null;
  mode: 'select' | 'draw' | 'move';

  // Actions
  setPlay: (play: PlayData) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  addLine: (line: Line) => void;
  updateLine: (id: string, updates: Partial<Line>) => void;
  removeLine: (id: string) => void;
  setSelectedPlayer: (id: string | null) => void;
  setSelectedLine: (id: string | null) => void;
  setMode: (mode: 'select' | 'draw' | 'move') => void;
}

export const usePlayStore = create<PlayState>((set) => ({
  play: null,
  selectedPlayerId: null,
  selectedLineId: null,
  mode: 'select',

  setPlay: (play) => set({ play }),

  addPlayer: (player) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            players: [...state.play.players, player],
          }
        : null,
    })),

  updatePlayer: (id, updates) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            players: state.play.players.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
          }
        : null,
    })),

  removePlayer: (id) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            players: state.play.players.filter((p) => p.id !== id),
          }
        : null,
    })),

  addLine: (line) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            lines: [...state.play.lines, line],
          }
        : null,
    })),

  updateLine: (id, updates) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            lines: state.play.lines.map((l) =>
              l.id === id ? { ...l, ...updates } : l
            ),
          }
        : null,
    })),

  removeLine: (id) =>
    set((state) => ({
      play: state.play
        ? {
            ...state.play,
            lines: state.play.lines.filter((l) => l.id !== id),
          }
        : null,
    })),

  setSelectedPlayer: (id) => set({ selectedPlayerId: id }),
  setSelectedLine: (id) => set({ selectedLineId: id }),
  setMode: (mode) => set({ mode }),
}));
