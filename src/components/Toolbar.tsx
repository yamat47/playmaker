interface ToolbarProps {
  onExport: () => void
}

const Toolbar = ({ onExport }: ToolbarProps) => {
  return (
    <div className="bg-white shadow-md p-4 flex items-center justify-between">
      <div className="text-sm text-gray-600">
        <span className="font-medium">操作方法:</span>
        <span className="ml-4">選手をドラッグで移動</span>
        <span className="ml-4">Shift+選手クリックで直線を描画</span>
        <span className="ml-4">Enterで直線を確定 / Escでキャンセル</span>
      </div>
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