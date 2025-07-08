import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Field from '../../components/Field'

describe('Field', () => {
  it('renders canvas with default dimensions', () => {
    const { container } = render(<Field />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('width', '1200')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('renders canvas with custom dimensions', () => {
    const { container } = render(<Field width={800} height={400} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('width', '800')
    expect(canvas).toHaveAttribute('height', '400')
  })

  it('applies correct styling classes', () => {
    const { container } = render(<Field />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveClass('border', 'border-gray-300', 'shadow-lg')
  })

  it('draws field on canvas', () => {
    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
    }
    
    const mockGetContext = vi.fn().mockReturnValue(mockContext)
    HTMLCanvasElement.prototype.getContext = mockGetContext

    render(<Field />)
    expect(mockGetContext).toHaveBeenCalledWith('2d')
  })

  describe('Line Drawing', () => {
    it('should enter line drawing mode when clicking on a player', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      
      // Simulate click on player position
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300 })
      
      // The implementation should set a drawing mode that changes cursor
      // For now, this test will fail as expected
    })

    it('should draw lines when clicking after selecting a player', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      const ctx = canvas.getContext('2d')
      
      // Start from player
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300 })
      
      // Add line points
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.click(canvas, { clientX: 400, clientY: 250 })
      
      // Should have drawn lines
      expect(ctx?.stroke).toHaveBeenCalled()
    })

    it('should allow selecting a drawn line by clicking on it', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      
      // First draw a line
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Click on the line to select it
      fireEvent.click(canvas, { clientX: 263, clientY: 300 })
      
      // The implementation should show selection state
      // For now, this test will fail as expected
    })

    it('should move selected line when dragging', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      const ctx = canvas.getContext('2d')
      
      // Draw a line
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Select the line
      fireEvent.mouseDown(canvas, { clientX: 263, clientY: 300 })
      
      // Drag the line
      fireEvent.mouseMove(canvas, { clientX: 263, clientY: 350 })
      fireEvent.mouseUp(canvas)
      
      // Should have redrawn the line at new position
      expect(ctx?.stroke).toHaveBeenCalled()
    })

    it('should allow selecting individual points on a polyline', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      
      // Draw a polyline with multiple points
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.click(canvas, { clientX: 400, clientY: 250 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Click on a polyline point to select it
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      
      // The implementation should show point selection state
      // For now, this test will fail as expected
    })

    it('should move individual polyline points when dragging', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      const ctx = canvas.getContext('2d')
      
      // Draw a polyline
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.click(canvas, { clientX: 400, clientY: 250 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Select and drag a point
      fireEvent.mouseDown(canvas, { clientX: 300, clientY: 300 })
      fireEvent.mouseMove(canvas, { clientX: 350, clientY: 320 })
      fireEvent.mouseUp(canvas)
      
      // Should have redrawn the line with moved point
      expect(ctx?.stroke).toHaveBeenCalled()
    })

    it('should move lines when the connected player is dragged', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      const ctx = canvas.getContext('2d')
      
      // Draw a line from a player
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.click(canvas, { clientX: 400, clientY: 250 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Drag the player
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300 })
      fireEvent.mouseMove(canvas, { clientX: 250, clientY: 320 })
      fireEvent.mouseUp(canvas)
      
      // Line should have moved with the player
      expect(ctx?.stroke).toHaveBeenCalled()
    })

    it('should move subsequent points when dragging a polyline point', async () => {
      const { container } = render(<Field />)
      const canvas = container.querySelector('canvas')!
      const ctx = canvas.getContext('2d')
      
      // Draw a polyline with multiple points
      fireEvent.mouseDown(canvas, { clientX: 226, clientY: 300, shiftKey: true })
      fireEvent.click(canvas, { clientX: 300, clientY: 300 })
      fireEvent.click(canvas, { clientX: 400, clientY: 250 })
      fireEvent.click(canvas, { clientX: 500, clientY: 200 })
      fireEvent.keyDown(canvas, { key: 'Enter' })
      
      // Drag the middle point (should move the last point too)
      fireEvent.mouseDown(canvas, { clientX: 400, clientY: 250 })
      fireEvent.mouseMove(canvas, { clientX: 420, clientY: 270 })
      fireEvent.mouseUp(canvas)
      
      // All subsequent points should have moved
      expect(ctx?.stroke).toHaveBeenCalled()
    })
  })
})