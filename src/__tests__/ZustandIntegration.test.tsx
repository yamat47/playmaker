import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import App from '../App';
import { useEditorStore } from '../stores/editorStore';

describe('Zustand Store Integration', () => {
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

  it('should show initial state correctly', () => {
    render(<App />);

    // Should show "No element selected"
    expect(screen.getByText('No element selected')).toBeInTheDocument();
  });

  it('should update UI when player is added and selected', async () => {
    const { rerender } = render(<App />);

    // Add and select a player through the store
    const player = {
      id: 'test-player-1',
      x: 100,
      y: 100,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ffffff',
      label: 'Test',
    };

    act(() => {
      useEditorStore.getState().addPlayer(player);
    });

    // Force rerender to ensure state updates are reflected
    rerender(<App />);

    act(() => {
      useEditorStore.getState().selectElement('test-player-1', 'player');
    });

    // Force another rerender
    rerender(<App />);

    // Wait for UI to update
    await waitFor(
      () => {
        // Check if "No element selected" is gone
        expect(
          screen.queryByText('No element selected'),
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Check if player properties are shown
    await waitFor(
      () => {
        expect(screen.getByText('Shape')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('should verify store state directly', () => {
    const player = {
      id: 'store-test-player',
      x: 100,
      y: 100,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ffffff',
      label: 'Store Test',
    };

    // Add player and select it
    act(() => {
      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('store-test-player', 'player');
    });

    // Verify store state
    const state = useEditorStore.getState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0].id).toBe('store-test-player');
    expect(state.selectedElementId).toBe('store-test-player');
    expect(state.selectedElementType).toBe('player');
  });
});
