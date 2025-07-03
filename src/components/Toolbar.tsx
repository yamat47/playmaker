import { useState } from 'react'

interface ToolbarProps {
  onModeChange: (mode: 'offense' | 'defense') => void
  onPlayTypeChange: (type: 'run' | 'pass') => void
  onExport: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const Toolbar = ({
  onModeChange,
  onPlayTypeChange,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: ToolbarProps) => {
  const [mode, setMode] = useState<'offense' | 'defense'>('offense')
  const [playType, setPlayType] = useState<'run' | 'pass'>('pass')

  const handleModeChange = (newMode: 'offense' | 'defense') => {
    setMode(newMode)
    onModeChange(newMode)
  }

  const handlePlayTypeChange = (newType: 'run' | 'pass') => {
    setPlayType(newType)
    onPlayTypeChange(newType)
  }

  return (
    <div className="bg-white shadow-md p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex rounded-md shadow-sm">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-l-md ${
              mode === 'offense'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => handleModeChange('offense')}
          >
            Offense
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-r-md ${
              mode === 'defense'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => handleModeChange('defense')}
          >
            Defense
          </button>
        </div>

        {mode === 'offense' && (
          <div className="flex rounded-md shadow-sm">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                playType === 'run'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => handlePlayTypeChange('run')}
            >
              Run Play
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                playType === 'pass'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => handlePlayTypeChange('pass')}
            >
              Pass Play
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          className={`px-3 py-2 text-sm font-medium rounded ${
            canUndo
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium rounded ${
            canRedo
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          onClick={onRedo}
          disabled={!canRedo}
        >
          Redo
        </button>
        <button
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700"
          onClick={onExport}
        >
          Export PNG
        </button>
      </div>
    </div>
  )
}

export default Toolbar
