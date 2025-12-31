import { describe, it, expect } from 'vitest';
import type { PlayData, Player, Line } from './index';

describe('Types', () => {
  it('should allow creating a valid PlayData object', () => {
    const playData: PlayData = {
      id: 'test-id',
      name: 'Test Play',
      players: [],
      lines: [],
      mode: 'offense',
    };

    expect(playData.id).toBe('test-id');
    expect(playData.name).toBe('Test Play');
    expect(playData.mode).toBe('offense');
  });

  it('should allow creating a valid Player object', () => {
    const player: Player = {
      id: 'player-1',
      x: 100,
      y: 200,
      label: 'QB',
      team: 'offense',
      shape: 'circle',
    };

    expect(player.label).toBe('QB');
    expect(player.team).toBe('offense');
  });

  it('should allow creating a valid Line object', () => {
    const line: Line = {
      id: 'line-1',
      type: 'route',
      points: [0, 0, 100, 100],
      playerId: 'player-1',
      style: {
        color: '#ff0000',
        thickness: 2,
        dashed: false,
        arrowEnd: true,
      },
    };

    expect(line.type).toBe('route');
    expect(line.style.arrowEnd).toBe(true);
  });
});
