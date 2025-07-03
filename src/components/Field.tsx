import { useRef, useEffect } from 'react'

interface FieldProps {
  width?: number
  height?: number
}

const Field = ({ width = 1200, height = 600 }: FieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#4a7c59'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    const yardWidth = width / 12
    for (let i = 1; i <= 11; i++) {
      const x = i * yardWidth
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    ctx.font = 'bold 24px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const yardNumbers = ['10', '20', '30', '40', '50', '40', '30', '20', '10']
    for (let i = 0; i < yardNumbers.length; i++) {
      const x = (i + 1.5) * yardWidth
      ctx.fillText(yardNumbers[i], x, height / 2)
    }

    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(yardWidth, 0)
    ctx.lineTo(yardWidth, height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(width - yardWidth, 0)
    ctx.lineTo(width - yardWidth, height)
    ctx.stroke()

    const hashWidth = width / 120
    for (let i = 1; i <= 119; i++) {
      const x = i * hashWidth
      if (i % 10 !== 0) {
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, height * 0.3)
        ctx.lineTo(x, height * 0.3 + 10)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, height * 0.7 - 10)
        ctx.lineTo(x, height * 0.7)
        ctx.stroke()
      }
    }
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 shadow-lg"
    />
  )
}

export default Field
