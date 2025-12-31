import { describe, it, expect, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useEditorStore } from '../stores/editorStore';

describe('Property Panel Display', () => {
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

  it('should not show player properties when no player is selected', () => {
    render(<App />);

    // Properties title should be visible
    expect(screen.getByText('Properties')).toBeInTheDocument();

    // Player-specific properties should not be visible
    expect(screen.queryByText('Shape')).not.toBeInTheDocument();
    expect(screen.queryByText('Label')).not.toBeInTheDocument();
    expect(screen.queryByText('Color')).not.toBeInTheDocument();
    expect(screen.queryByText('Route')).not.toBeInTheDocument();
  });

  it('should show player properties when a player is selected via store', async () => {
    render(<App />);

    // Add a player and select it through the store
    const player = {
      id: 'player1',
      x: 100,
      y: 100,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ffffff',
      label: 'QB',
    };

    act(() => {
      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('player1', 'player');
    });

    // Properties should be visible after selection
    await waitFor(() => {
      expect(screen.getByText('Shape')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Draw Route')).toBeInTheDocument();
      expect(screen.getByText('Delete Player')).toBeInTheDocument();
    });
  });

  it('should show player properties when a player is clicked on the field', async () => {
    const { container } = render(<App />);

    // Add a player to the field
    const player = {
      id: 'player1',
      x: 600,
      y: 300,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ffffff',
      label: '',
    };

    act(() => {
      useEditorStore.getState().addPlayer(player);
    });

    // Click on the canvas at player position
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    if (canvas) {
      // Simulate click on player position
      fireEvent.mouseDown(canvas, {
        clientX: 600,
        clientY: 300,
      });

      fireEvent.mouseUp(canvas, {
        clientX: 600,
        clientY: 300,
      });
    }

    // Properties should be visible after clicking
    await waitFor(() => {
      expect(screen.getByText('Shape')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Draw Route')).toBeInTheDocument();
    });
  });

  it('should show player properties when a new player is added', async () => {
    const { container } = render(<App />);
    const user = userEvent.setup();

    // Click on the "Add Player" tool
    const addPlayerButton = screen.getByTitle('Add Player');
    await user.click(addPlayerButton);

    // Click on the canvas to add a player
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    if (canvas) {
      fireEvent.mouseDown(canvas, {
        clientX: 600,
        clientY: 300,
      });

      fireEvent.mouseUp(canvas, {
        clientX: 600,
        clientY: 300,
      });
    }

    // The new player should be selected and properties should be visible
    await waitFor(() => {
      expect(screen.getByText('Shape')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Draw Route')).toBeInTheDocument();
    });
  });

  it('should update properties panel when switching between players', async () => {
    render(<App />);

    // Add two players with different properties
    const player1 = {
      id: 'player1',
      x: 100,
      y: 100,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ff0000',
      label: 'QB',
    };

    const player2 = {
      id: 'player2',
      x: 200,
      y: 200,
      team: 'defense' as const,
      shape: 'square' as const,
      color: '#0000ff',
      label: 'LB',
    };

    act(() => {
      useEditorStore.getState().addPlayer(player1);
      useEditorStore.getState().addPlayer(player2);
    });

    // Select first player
    act(() => {
      useEditorStore.getState().selectElement('player1', 'player');
    });

    await waitFor(() => {
      const labelInput = screen.getByDisplayValue('QB');
      expect(labelInput).toBeInTheDocument();
    });

    // Select second player
    act(() => {
      useEditorStore.getState().selectElement('player2', 'player');
    });

    await waitFor(() => {
      const labelInput = screen.getByDisplayValue('LB');
      expect(labelInput).toBeInTheDocument();
    });
  });

  it('should hide player properties when selection is cleared', async () => {
    render(<App />);

    // Add and select a player
    const player = {
      id: 'player1',
      x: 100,
      y: 100,
      team: 'offense' as const,
      shape: 'circle' as const,
      color: '#ffffff',
      label: 'QB',
    };

    act(() => {
      useEditorStore.getState().addPlayer(player);
      useEditorStore.getState().selectElement('player1', 'player');
    });

    // Properties should be visible
    await waitFor(() => {
      expect(screen.getByText('Shape')).toBeInTheDocument();
    });

    // Clear selection
    act(() => {
      useEditorStore.getState().clearSelection();
    });

    // Properties should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Shape')).not.toBeInTheDocument();
      expect(screen.queryByText('Label')).not.toBeInTheDocument();
      expect(screen.queryByText('Color')).not.toBeInTheDocument();
      expect(screen.queryByText('Draw Route')).not.toBeInTheDocument();
    });
  });
});
