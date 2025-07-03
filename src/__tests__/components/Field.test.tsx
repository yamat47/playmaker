import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
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
    const mockGetContext = vi.fn().mockReturnValue({
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
    })

    HTMLCanvasElement.prototype.getContext = mockGetContext

    render(<Field />)
    expect(mockGetContext).toHaveBeenCalledWith('2d')
  })
})