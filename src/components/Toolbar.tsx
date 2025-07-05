interface ToolbarProps {
  onExport: () => void
}

const Toolbar = ({ onExport }: ToolbarProps) => {
  return (
    <div className="bg-white shadow-md p-4 flex items-center justify-end">
      <button
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700"
        onClick={onExport}
      >
        Export PNG
      </button>
    </div>
  )
}

export default Toolbar