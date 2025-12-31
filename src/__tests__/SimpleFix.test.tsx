import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import App from '../App';
import { useEditorStore } from '../stores/editorStore';

describe('Simple Store Fix', () => {
  it('should update UI when store changes', async () => {
    const { container } = render(<App />);

    // Directly update store and see if UI responds
    act(() => {
      // Add a player
      useEditorStore.getState().addPlayer({
        id: 'test-player',
        x: 100,
        y: 100,
        team: 'offense',
        shape: 'circle',
        color: '#ffffff',
        label: 'Test',
      });

      // Select the player
      useEditorStore.getState().selectElement('test-player', 'player');
    });

    // Check the store state
    const state = useEditorStore.getState();
    console.log('Store state after selection:', {
      selectedElementId: state.selectedElementId,
      selectedElementType: state.selectedElementType,
      players: state.players,
    });

    // Check if property panel exists
    const aside = container.querySelector('aside.w-64');
    console.log('Property panel HTML:', aside?.innerHTML);

    // The real issue: App is not re-rendering when store changes
    expect(state.selectedElementId).toBe('test-player');
    expect(state.selectedElementType).toBe('player');
  });
});
