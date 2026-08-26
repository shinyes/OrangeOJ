import { useCallback, useState } from 'react'

export default function useStatementZoom({ min = 0.75, max = 2, step = 0.1, initial = 1 } = {}) {
  const [scale, setScale] = useState(initial)
  const clamp = useCallback((value) => Math.min(max, Math.max(min, value)), [min, max])
  const zoomIn = useCallback(() => setScale((current) => clamp(Number((current + step).toFixed(2)))), [clamp, step])
  const zoomOut = useCallback(() => setScale((current) => clamp(Number((current - step).toFixed(2)))), [clamp, step])
  const reset = useCallback(() => setScale(initial), [initial])
  const handleWheel = useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const delta = event.deltaY < 0 ? step : -step
      setScale((current) => clamp(Number((current + delta).toFixed(2))))
    }
  }, [clamp, step])
  return { scale, zoomIn, zoomOut, reset, handleWheel }
}
