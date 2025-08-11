import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editorStore';
import type { Player, Line, RouteDrawingState } from '../../types';

describe('editorStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useEditorStore.setState({
      players: [],
      lines: [],
      selectedElementId: null,
      selectedElementType: null,
      selectedSegmentPath: null,
      currentTool: 'select',
      startRouteDrawing: null,
    });
  });

  describe('Player management', () => {
    it('should add a player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      const players = useEditorStore.getState().players;

      expect(players).toHaveLength(1);
      expect(players[0]).toEqual(player);
    });

    it('should update a player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().updatePlayer('player1', { x: 150, y: 250 });

      const updatedPlayer = useEditorStore.getState().players[0];
      expect(updatedPlayer.x).toBe(150);
      expect(updatedPlayer.y).toBe(250);
    });

    it('should delete a player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().deletePlayer('player1');

      expect(useEditorStore.getState().players).toHaveLength(0);
    });

    it('should delete associated lines when deleting a player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().addLine(line);
      useEditorStore.getState().deletePlayer('player1');

      expect(useEditorStore.getState().players).toHaveLength(0);
      expect(useEditorStore.getState().lines).toHaveLength(0);
    });

    it('should set all players at once', () => {
      const players: Player[] = [
        {
          id: 'player1',
          x: 100,
          y: 200,
          team: 'offense',
          shape: 'circle',
          color: '#ff0000',
        },
        {
          id: 'player2',
          x: 200,
          y: 300,
          team: 'defense',
          shape: 'square',
          color: '#0000ff',
        },
      ];

      useEditorStore.getState().setPlayers(players);
      expect(useEditorStore.getState().players).toEqual(players);
    });
  });

  describe('Line management', () => {
    it('should add a line', () => {
      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addLine(line);
      const lines = useEditorStore.getState().lines;

      expect(lines).toHaveLength(1);
      expect(lines[0]).toEqual(line);
    });

    it('should update a line', () => {
      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addLine(line);
      useEditorStore
        .getState()
        .updateLine('line1', { segments: [{ points: [], type: 'solid' }] });

      const updatedLine = useEditorStore.getState().lines[0];
      expect(updatedLine.segments).toHaveLength(1);
    });

    it('should delete a line', () => {
      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addLine(line);
      useEditorStore.getState().deleteLine('line1');

      expect(useEditorStore.getState().lines).toHaveLength(0);
    });

    it('should set all lines at once', () => {
      const lines: Line[] = [
        {
          id: 'line1',
          playerId: 'player1',
          segments: [],
        },
        {
          id: 'line2',
          playerId: 'player2',
          segments: [],
        },
      ];

      useEditorStore.getState().setLines(lines);
      expect(useEditorStore.getState().lines).toEqual(lines);
    });
  });

  describe('Selection management', () => {
    it('should select a player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('player1', 'player');

      expect(useEditorStore.getState().selectedElementId).toBe('player1');
      expect(useEditorStore.getState().selectedElementType).toBe('player');
    });

    it('should select a line', () => {
      useEditorStore.getState().selectElement('line1', 'line', [0, 1]);

      expect(useEditorStore.getState().selectedElementId).toBe('line1');
      expect(useEditorStore.getState().selectedElementType).toBe('line');
      expect(useEditorStore.getState().selectedSegmentPath).toEqual([0, 1]);
    });

    it('should clear selection', () => {
      useEditorStore.getState().selectElement('player1', 'player');
      useEditorStore.getState().clearSelection();

      expect(useEditorStore.getState().selectedElementId).toBeNull();
      expect(useEditorStore.getState().selectedElementType).toBeNull();
      expect(useEditorStore.getState().selectedSegmentPath).toBeNull();
    });

    it('should get selected player', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('player1', 'player');

      const selectedPlayer = useEditorStore.getState().getSelectedPlayer();
      expect(selectedPlayer).toEqual(player);
    });

    it('should get selected line', () => {
      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addLine(line);
      useEditorStore.getState().selectElement('line1', 'line');

      const selectedLine = useEditorStore.getState().getSelectedLine();
      expect(selectedLine).toEqual(line);
    });
  });

  describe('Tool management', () => {
    it('should set current tool', () => {
      useEditorStore.getState().setTool('player');
      expect(useEditorStore.getState().currentTool).toBe('player');
    });

    it('should default to select tool', () => {
      expect(useEditorStore.getState().currentTool).toBe('select');
    });
  });

  describe('Route drawing management', () => {
    it('should start route drawing', () => {
      const routeDrawing: RouteDrawingState = {
        playerId: 'player1',
        routeType: 'solid',
      };

      useEditorStore.getState().startDrawingRoute(routeDrawing);
      expect(useEditorStore.getState().startRouteDrawing).toEqual(routeDrawing);
    });

    it('should stop route drawing', () => {
      const routeDrawing: RouteDrawingState = {
        playerId: 'player1',
        routeType: 'solid',
      };

      useEditorStore.getState().startDrawingRoute(routeDrawing);
      useEditorStore.getState().stopDrawingRoute();

      expect(useEditorStore.getState().startRouteDrawing).toBeNull();
    });
  });

  describe('Bulk operations', () => {
    it('should delete selected element', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('player1', 'player');
      useEditorStore.getState().deleteSelected();

      expect(useEditorStore.getState().players).toHaveLength(0);
      expect(useEditorStore.getState().selectedElementId).toBeNull();
    });

    it('should delete all elements', () => {
      const player: Player = {
        id: 'player1',
        x: 100,
        y: 200,
        team: 'offense',
        shape: 'circle',
        color: '#ff0000',
      };

      const line: Line = {
        id: 'line1',
        playerId: 'player1',
        segments: [],
      };

      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().addLine(line);
      useEditorStore.getState().deleteAll();

      expect(useEditorStore.getState().players).toHaveLength(0);
      expect(useEditorStore.getState().lines).toHaveLength(0);
    });
  });
});
