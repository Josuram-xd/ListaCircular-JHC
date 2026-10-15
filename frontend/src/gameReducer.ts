import type { GameState, HandResult, ServerMessage } from './types'

export interface LogEntry { id: number; text: string }
export interface Toast { id: number; text: string }

export interface ClientState {
  state: GameState | null
  log: LogEntry[]
  result: HandResult | null
  resultHand: number | null
  gameOverWinner: string | null
  toasts: Toast[]
  seq: number
}

export const initialClientState: ClientState = {
  state: null, log: [], result: null, resultHand: null, gameOverWinner: null, toasts: [], seq: 0,
}

export type Msg =
  | ServerMessage
  | { type: 'dismiss_toast'; id: number }
  | { type: 'reset' }
  | { type: 'notice'; text: string }

function nameOf(state: GameState | null, id: string): string {
  return state?.players.find((p) => p.id === id)?.name ?? id
}

export function describeBotAction(name: string, action: string, amount?: number): string {
  switch (action) {
    case 'fold': return `${name} se retira`
    case 'check': return `${name} pasa`
    case 'call': return amount ? `${name} iguala ${amount}` : `${name} iguala`
    case 'raise': return `${name} sube a ${amount ?? ''}`.trim()
    case 'all_in': return `${name} va all-in${amount ? ` (${amount})` : ''}`
    default: return `${name}: ${action}`
  }
}

/** Siempre reemplaza el state completo con el recibido. */
export function clientReducer(s: ClientState, m: Msg): ClientState {
  const seq = s.seq + 1
  switch (m.type) {
    case 'state': {
      const next: ClientState = { ...s, state: m.state, seq }
      // el resultado solo vale para la mano en la que se produjo
      const betting = m.state.phase !== 'hand_over' && m.state.phase !== 'showdown' && m.state.phase !== 'game_over'
      if (betting || (s.resultHand !== null && s.resultHand !== m.state.hand_number)) {
        next.result = null
        next.resultHand = null
      }
      // fin de partida derivado del estado (tambien tras reconexion)
      if (m.state.phase === 'game_over' && !s.gameOverWinner) {
        const alive = m.state.players.find((p) => p.chips > 0 && p.status !== 'out')
        if (alive) next.gameOverWinner = alive.id
      }
      return next
    }
    case 'bot_action':
      return {
        ...s, seq,
        log: [...s.log, { id: seq, text: describeBotAction(nameOf(s.state, m.player_id), m.action, m.amount) }].slice(-50),
      }
    case 'hand_result':
      return { ...s, seq, resultHand: s.state?.hand_number ?? null, result: { winners: m.winners, pot: m.pot, hand_name: m.hand_name, showdown: m.showdown } }
    case 'game_over':
      return { ...s, seq, gameOverWinner: m.winner_id }
    case 'error':
      return { ...s, seq, toasts: [...s.toasts, { id: seq, text: m.message || m.code }] }
    case 'notice':
      return { ...s, seq, toasts: [...s.toasts, { id: seq, text: m.text }] }
    case 'dismiss_toast':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== m.id) }
    case 'reset':
      return initialClientState
    default:
      return s
  }
}
