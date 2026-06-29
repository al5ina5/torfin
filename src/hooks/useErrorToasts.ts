import { useEffect, useRef } from 'react'

import { toast } from '../lib/toast'

export function useMessageToast(
  message: string,
  type: 'error' | 'warning' = 'error',
  title?: string,
) {
  const lastRef = useRef('')

  useEffect(() => {
    if (!message) {
      lastRef.current = ''
      return
    }
    if (message === lastRef.current) return
    lastRef.current = message
    if (type === 'warning') toast.warning(title || 'Notice', message)
    else toast.error(title || 'Something went wrong', message)
  }, [message, type, title])
}

export function useErrorListToast(errors: string[], title = 'Stream source issue') {
  const lastKeyRef = useRef('')

  useEffect(() => {
    if (!errors.length) {
      lastKeyRef.current = ''
      return
    }
    const key = errors.join('|')
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key
    errors.slice(0, 3).forEach((error) => toast.warning(title, error))
  }, [errors, title])
}
