import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { wsUrl } from './api'
import { clientReducer, initialClientState } from './gameReducer'
import type { ClientMessage, ServerMessage } from './types'

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

const MAX_RETRIES = 5

/** Cierres definitivos del servidor: no se reintenta. */
export const FATAL_CLOSE: Record<number, string> = {
  4404: 'Partida no encontrada',
  4403: 'Conexión rechazada',
  4409: 'Partida abierta en otra pestaña',
}

export function backoffDelay(retry: number, base: number): number {
  return base * 2 ** (retry - 1)
}

export function useGameSocket(gameId: string | null, retryDelayMs = 1500) {
  const [client, dispatch] = useReducer(clientReducer, initialClientState)
  const [status, setStatus] = useState<ConnStatus>('closed')
  const [closeReason, setCloseReason] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!gameId) { setStatus('closed'); return }
    setCloseReason(null)
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
      ws.onclose = (ev) => {
        if (disposed) return
        const fatal = FATAL_CLOSE[ev?.code]
        if (fatal) {
          setCloseReason(fatal)
          setStatus('closed')
          return
        }
        if (retries < MAX_RETRIES) {
          retries += 1
          setStatus('reconnecting')
          timer = setTimeout(connect, backoffDelay(retries, retryDelayMs))
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

  return { client, status, send, dismissToast, closeReason }
}
