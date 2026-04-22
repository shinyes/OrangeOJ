import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

export const ToastContext = createContext({
  showToast: () => {}
})

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [currentToast, setCurrentToast] = useState(null)
  const [open, setOpen] = useState(false)

  const showToast = useCallback((message, options = {}) => {
    const text = String(message || '').trim()
    if (!text) {
      return
    }
    setQueue((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message: text,
        severity: options.severity || 'info',
        autoHideDuration: options.autoHideDuration ?? 2500
      }
    ])
  }, [])

  useEffect(() => {
    if (currentToast || queue.length === 0) {
      return
    }
    setCurrentToast(queue[0])
    setQueue((current) => current.slice(1))
    setOpen(true)
  }, [currentToast, queue])

  const handleClose = useCallback((event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setOpen(false)
  }, [])

  const handleExited = useCallback(() => {
    setCurrentToast(null)
  }, [])

  const contextValue = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={currentToast?.autoHideDuration ?? 2500}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionProps={{ onExited: handleExited }}
      >
        <Alert
          severity={currentToast?.severity || 'info'}
          onClose={handleClose}
          variant="filled"
          sx={{ width: '100%', minWidth: 280, alignItems: 'center' }}
        >
          {currentToast?.message || ''}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}
