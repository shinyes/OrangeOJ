import { createContext, useCallback, useContext, useMemo } from 'react'
import { toast } from 'sonner'

export const ToastContext = createContext({
  showToast: () => {}
})

export function ToastProvider({ children }) {
  const showToast = useCallback((message, options = {}) => {
    const text = String(message || '').trim()
    if (!text) return

    const severity = options.severity || 'info'
    const duration = options.autoHideDuration ?? 2500

    switch (severity) {
      case 'error':
        toast.error(text, { duration })
        break
      case 'success':
        toast.success(text, { duration })
        break
      case 'warning':
        toast.warning(text, { duration })
        break
      case 'info':
      default:
        toast.info(text, { duration })
        break
    }
  }, [])

  const contextValue = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
