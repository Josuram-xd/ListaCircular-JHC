import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { wsUrl } from './api'
import { clientReducer, initialClientState } from './gameReducer'
import type { ClientMessage, ServerMessage } from './types'

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

const MAX_RETRIES = 5

export function useGameSocket(gameId: string | null, retryDelayMs = 1500) {
  const [client, dispatch] = useReducer(clientReducer, initialClientState)
  const [status, setStatus] = useState<ConnStatus>('closed')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!gameId) { setStatus('closed'); return }
    let disposed = false
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      setStatus(retries === 0 ? 'connecting' : 'reconnecting')
      const ws = new WebSocket(wsUrl(gameId))
      wsRef.current = ws
      ws.onopen = () => { retries = 0; setStatus('open') }
      ws.onmessage = (ev) => {
        try {
          dispatch(JSON.parse(ev.data as string) as ServerMessage)
        } catch {
          dispatch({ type: 'notice', text: 'Mensaje inválido del servidor' })
        }
      }
      ws.onclose = () => {
        if (disposed) return
        if (retries < MAX_RETRIES) {
          retries += 1
          setStatus('reconnecting')
          timer = setTimeout(connect, retryDelayMs)
        } else {
          setStatus('closed')
        }
      }
    }
    dispatch({ type: 'reset' })
    connect()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [gameId, retryDelayMs])

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
      return true
    }
    dispatch({ type: 'notice', text: 'Sin conexión con el servidor' })
    return false
  }, [])

  const dismissToast = useCallback((id: number) => dispatch({ type: 'dismiss_toast', id }), [])

  return { client, status, send, dismissToast }
}
