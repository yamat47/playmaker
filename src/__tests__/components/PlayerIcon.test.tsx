import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlayerIcon from '../../components/PlayerIcon'

describe('PlayerIcon', () => {
  it('renders player label', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" />)
    expect(screen.getByText('QB')).toBeInTheDocument()
  })

  it('applies correct position', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" />)
    const element = screen.getByText('QB')
    expect(element).toHaveStyle({ left: '80px', top: '80px' })
  })

  it('applies offense styling', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" />)
    const element = screen.getByText('QB')
    expect(element).toHaveClass('bg-blue-600')
  })

  it('applies defense styling', () => {
    render(<PlayerIcon x={100} y={100} label="DE" type="defense" />)
    const element = screen.getByText('DE')
    expect(element).toHaveClass('bg-red-600')
  })

  it('applies selected styling', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" selected={true} />)
    const element = screen.getByText('QB')
    expect(element).toHaveClass('ring-4', 'ring-yellow-400', 'scale-110')
  })

  it('applies circle shape by default', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" />)
    const element = screen.getByText('QB')
    expect(element).toHaveClass('rounded-full')
  })

  it('applies square shape when specified', () => {
    render(<PlayerIcon x={100} y={100} label="QB" type="offense" shape="square" />)
    const element = screen.getByText('QB')
    expect(element).toHaveClass('rounded-md')
  })
})