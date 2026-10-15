import { useEffect, useState } from 'react'
import type { ClientMessage, GameState } from '../types'

interface Props {
  state: GameState
  send: (m: ClientMessage) => boolean | void
}

const BETTING = ['preflop', 'flop', 'turn', 'river']

export function clampRaise(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(Math.round(value), min), max)
}

export default function Controls({ state, send }: Props) {
  const me = state.players.find((p) => !p.is_bot)
  const myTurn = !!me && state.turn_id === me.id && BETTING.includes(state.phase)
  const [raise, setRaise] = useState(state.min_raise)
  const [raiseText, setRaiseText] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // un nuevo state del servidor libera los botones
  useEffect(() => { setPending(false) }, [state])
  // red de seguridad si el servidor responde con error y no con state
  useEffect(() => {
    if (!pending) return
    const h = setTimeout(() => setPending(false), 3000)
    return () => clearTimeout(h)
  }, [pending])

  useEffect(() => {
    setRaise((r) => clampRaise(r, state.min_raise, Math.max(state.min_raise, state.max_bet)))
  }, [state.min_raise, state.max_bet])

  if (!me || !myTurn) {
    return <div className="controls controls--idle" data-testid="controls-idle">
      {state.phase === 'hand_over' || state.phase === 'game_over' ? '' : 'Esperando turno…'}
    </div>
  }

  const toCall = Math.min(Math.max(state.current_bet - me.bet, 0), me.chips)
  const canRaise = state.max_bet > state.current_bet && me.chips > toCall
  const value = clampRaise(raise, state.min_raise, state.max_bet)

  const act = (m: ClientMessage) => {
    if (pending) return
    if (send(m) !== false) setPending(true)
  }
  const commitText = () => {
    if (raiseText !== null) setRaise(clampRaise(Number(raiseText), state.min_raise, state.max_bet))
    setRaiseText(null)
  }

  return (
    <div className="controls" data-testid="controls">
      <div className="controls__row">
        <button className="btn btn--danger" disabled={pending}
          onClick={() => act({ type: 'action', action: 'fold' })}>
          Fold
        </button>
        <button className="btn" disabled={pending} onClick={() => act({ type: 'action', action: 'call' })}>
          {toCall === 0 ? 'Check' : `Call ${toCall}`}
        </button>
        <button
          className="btn btn--primary"
          disabled={!canRaise || pending}
          onClick={() => { commitText(); act({ type: 'action', action: 'raise', amount: raiseText !== null ? clampRaise(Number(raiseText), state.min_raise, state.max_bet) : value }) }}
        >
          Raise a {value}
        </button>
        <button className="btn btn--gold" disabled={pending} onClick={() => act({ type: 'action', action: 'all_in' })}>
          All-in
        </button>
      </div>
      {canRaise && (
        <div className="controls__raise">
          <input
            type="range"
            aria-label="Monto de subida"
            min={state.min_raise}
            max={state.max_bet}
            value={value}
            onChange={(e) => { setRaiseText(null); setRaise(Number(e.target.value)) }}
          />
          <input
            type="number"
            aria-label="Monto de subida (número)"
            min={state.min_raise}
            max={state.max_bet}
            value={raiseText ?? value}
            onChange={(e) => setRaiseText(e.target.value)}
            onBlur={commitText}
          />
        </div>
      )}
    </div>
  )
}
