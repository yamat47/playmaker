import Field from './components/Field'
import Toolbar from './components/Toolbar'

function App() {

  const handleExport = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    
    const link = document.createElement('a')
    link.download = 'play-diagram.png'
    link.href = canvas.toDataURL()
    link.click()
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
        onExport={handleExport}
      />

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="relative">
          <Field />
        </div>
      </main>
    </div>
  )
}

export default App
