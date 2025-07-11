import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders title', () => {
    render(<App />);
    expect(screen.getByText('Playmaker')).toBeInTheDocument();
  });

  it('renders Field component', () => {
    const { container } = render(<App />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    render(<App />);
    expect(screen.getByTitle('Select')).toBeInTheDocument();
    expect(screen.getByTitle('Add Player')).toBeInTheDocument();
    expect(screen.getByTitle('Formations')).toBeInTheDocument();
    expect(screen.getByTitle('Add Text')).toBeInTheDocument();
    expect(screen.getByTitle('Blocking')).toBeInTheDocument();
    expect(screen.getByTitle('Eraser')).toBeInTheDocument();
  });
});
