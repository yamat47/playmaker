import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders title', () => {
    render(<App />)
    expect(screen.getByText('Playmaker - Football Play Diagramming Tool')).toBeInTheDocument()
  })

  it('renders all offense players', () => {
    render(<App />)
    expect(screen.getByText('QB')).toBeInTheDocument()
    expect(screen.getByText('RB')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('LG')).toBeInTheDocument()
    expect(screen.getByText('RG')).toBeInTheDocument()
    expect(screen.getByText('LT')).toBeInTheDocument()
    expect(screen.getByText('RT')).toBeInTheDocument()
    expect(screen.getByText('TE')).toBeInTheDocument()
    expect(screen.getAllByText('WR')).toHaveLength(3)
  })

  it('renders all defense players', () => {
    render(<App />)
    expect(screen.getAllByText('DE')).toHaveLength(2)
    expect(screen.getByText('DT')).toBeInTheDocument()
    expect(screen.getAllByText('OLB')).toHaveLength(2)
    expect(screen.getAllByText('MLB')).toHaveLength(2)
    expect(screen.getAllByText('CB')).toHaveLength(2)
    expect(screen.getByText('SS')).toBeInTheDocument()
    expect(screen.getByText('FS')).toBeInTheDocument()
  })
})