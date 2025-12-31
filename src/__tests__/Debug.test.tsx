import { describe, it, expect } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useEditorStore } from '../stores/editorStore';

describe('Debug - Property Panel Issue', () => {
  it('should debug player selection state', async () => {
    const { container } = render(<App />);
    const user = userEvent.setup();

    // Initial state check
    const initialState = useEditorStore.getState();
    console.log('Initial state:', {
      selectedElementId: initialState.selectedElementId,
      selectedElementType: initialState.selectedElementType,
      players: initialState.players,
    });

    // Click on the "Add Player" tool
    const addPlayerButton = screen.getByTitle('Add Player');
    await user.click(addPlayerButton);

    // Check state after selecting player tool
    const afterToolState = useEditorStore.getState();
    console.log('After selecting player tool:', {
      currentTool: afterToolState.currentTool,
    });

    // Click on the canvas to add a player
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    if (canvas) {
      // Simulate adding a player
      await act(async () => {
        // Get canvas bounding rect (mocked in test)
        const rect = { left: 0, top: 0 };

        // Click in the middle of the field
        fireEvent.mouseDown(canvas, {
          clientX: 600 - rect.left,
          clientY: 300 - rect.top,
        });

        fireEvent.mouseUp(canvas, {
          clientX: 600 - rect.left,
          clientY: 300 - rect.top,
        });
      });

      // Wait a bit for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check state after adding player
      const afterAddState = useEditorStore.getState();
      console.log('After adding player:', {
        players: afterAddState.players,
        selectedElementId: afterAddState.selectedElementId,
        selectedElementType: afterAddState.selectedElementType,
        currentTool: afterAddState.currentTool,
      });

      // Check if player was added
      expect(afterAddState.players.length).toBeGreaterThan(0);

      // Check if a player is selected
      if (afterAddState.selectedElementId) {
        console.log('Player is selected!');

        // Check if UI shows player properties
        const noElementText = screen.queryByText('No element selected');
        const shapeText = screen.queryByText('Shape');

        console.log('UI state:', {
          noElementSelected: noElementText !== null,
          shapeVisible: shapeText !== null,
        });
      } else {
        console.log('No player selected after adding!');
      }
    }
  });
});
