import { useEffect, useRef } from 'react'
import { useToast } from '../hooks/useToast'

export default function ToastMessage({
  message = '',
  severity = 'info',
  autoHideDuration,
  onShown
}) {
  const { showToast } = useToast()
  const shownRef = useRef(false)

  useEffect(() => {
    const text = String(message || '').trim()
    if (!text || shownRef.current) {
      return
    }
    shownRef.current = true
    showToast(text, { severity, autoHideDuration })
    onShown?.()
  }, [autoHideDuration, message, onShown, severity, showToast])

  return null
}
