import { useCallback, useRef, useState } from 'react'

export default function useConfirmDialog() {
  const resolverRef = useRef(null)
  const [options, setOptions] = useState(null)

  const close = useCallback((result) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    if (resolver) {
      resolver(result)
    }
  }, [])

  const confirm = useCallback((nextOptions) => new Promise((resolve) => {
    if (resolverRef.current) {
      resolverRef.current(false)
    }
    resolverRef.current = resolve
    setOptions(nextOptions || {})
  }), [])

  return {
    confirm,
    dialogProps: {
      open: Boolean(options),
      options,
      onCancel: () => close(false),
      onConfirm: () => close(true)
    }
  }
}
