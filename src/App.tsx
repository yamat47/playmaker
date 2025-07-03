import { useState } from 'react'
import Field from './components/Field'
import PlayerIcon from './components/PlayerIcon'
import Toolbar from './components/Toolbar'

interface Player {
  id: string
  x: number
  y: number
  label: string
  type: 'offense' | 'defense'
}

function App() {
  const [, setMode] = useState<'offense' | 'defense'>('offense')
  const [, setPlayType] = useState<'run' | 'pass'>('pass')
  const [players, setPlayers] = useState<Player[]>([
    // Offense players
    { id: 'o1', x: 600, y: 400, label: 'C', type: 'offense' },
    { id: 'o2', x: 550, y: 400, label: 'LG', type: 'offense' },
    { id: 'o3', x: 650, y: 400, label: 'RG', type: 'offense' },
    { id: 'o4', x: 500, y: 400, label: 'LT', type: 'offense' },
    { id: 'o5', x: 700, y: 400, label: 'RT', type: 'offense' },
    { id: 'o6', x: 600, y: 450, label: 'QB', type: 'offense' },
    { id: 'o7', x: 600, y: 500, label: 'RB', type: 'offense' },
    { id: 'o8', x: 400, y: 390, label: 'WR', type: 'offense' },
    { id: 'o9', x: 800, y: 390, label: 'WR', type: 'offense' },
    { id: 'o10', x: 750, y: 410, label: 'TE', type: 'offense' },
    { id: 'o11', x: 500, y: 380, label: 'WR', type: 'offense' },
    // Defense players
    { id: 'd1', x: 550, y: 350, label: 'DE', type: 'defense' },
    { id: 'd2', x: 600, y: 350, label: 'DT', type: 'defense' },
    { id: 'd3', x: 650, y: 350, label: 'DE', type: 'defense' },
    { id: 'd4', x: 500, y: 350, label: 'OLB', type: 'defense' },
    { id: 'd5', x: 700, y: 350, label: 'OLB', type: 'defense' },
    { id: 'd6', x: 550, y: 300, label: 'MLB', type: 'defense' },
    { id: 'd7', x: 650, y: 300, label: 'MLB', type: 'defense' },
    { id: 'd8', x: 450, y: 250, label: 'CB', type: 'defense' },
    { id: 'd9', x: 750, y: 250, label: 'CB', type: 'defense' },
    { id: 'd10', x: 550, y: 200, label: 'SS', type: 'defense' },
    { id: 'd11', x: 650, y: 200, label: 'FS', type: 'defense' },
  ])
  const [selectedPlayer] = useState<string | null>(null)
  const [history, setHistory] = useState<Player[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const handleExport = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    
    const link = document.createElement('a')
    link.download = 'play-diagram.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setPlayers(history[historyIndex - 1])
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setPlayers(history[historyIndex + 1])
    }
  }

  const handlePlayerDragEnd = (playerId: string, e: React.DragEvent) => {
    const fieldRect = e.currentTarget.parentElement?.getBoundingClientRect()
    if (!fieldRect) return

    const newX = e.clientX - fieldRect.left
    const newY = e.clientY - fieldRect.top

    const newPlayers = players.map(p => 
      p.id === playerId ? { ...p, x: newX, y: newY } : p
    )
    
    setPlayers(newPlayers)
    const newHistory = [...history.slice(0, historyIndex + 1), newPlayers]
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Playmaker - Football Play Diagramming Tool
          </h1>
        </div>
      </header>
      
      <Toolbar
        onModeChange={setMode}
        onPlayTypeChange={setPlayType}
        onExport={handleExport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="relative">
          <Field />
          {players.map(player => (
            <PlayerIcon
              key={player.id}
              x={player.x}
              y={player.y}
              label={player.label}
              type={player.type}
              selected={selectedPlayer === player.id}
              onDragEnd={(e) => handlePlayerDragEnd(player.id, e)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

export default App
