interface PlayerIconProps {
  x: number
  y: number
  label: string
  type: 'offense' | 'defense'
  shape?: 'circle' | 'square'
  selected?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

const PlayerIcon = ({
  x,
  y,
  label,
  type,
  shape = 'circle',
  selected = false,
  onDragStart,
  onDragEnd
}: PlayerIconProps) => {
  const baseClasses = `
    absolute w-10 h-10 flex items-center justify-center
    text-white font-bold text-sm cursor-move
    transition-all duration-150 select-none
    ${selected ? 'ring-4 ring-yellow-400 scale-110' : ''}
    ${type === 'offense' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
    ${shape === 'circle' ? 'rounded-full' : 'rounded-md'}
  `

  return (
    <div
      className={baseClasses}
      style={{ left: x - 20, top: y - 20 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {label}
    </div>
  )
}

export default PlayerIcon
