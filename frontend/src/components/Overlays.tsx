import { useEffect, useRef } from 'react'
import type { GameState, HandResult } from '../types'
import type { LogEntry, Toast } from '../gameReducer'

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const h = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(h)
  }, [toast.id, onDismiss])
  return (
    <button type="button" className="toast" onClick={() => onDismiss(toast.id)}>{toast.text}</button>
  )
}

export function ActionLog({ log }: { log: LogEntry[] }) {
  const last = log.slice(-8)
  return (
    <div className="log" data-testid="log">
      <h3>Acciones</h3>
      {last.length === 0 && <div className="log__empty">Sin acciones aún</div>}
      {last.map((e) => <div key={e.id} className="log__item">{e.text}</div>)}
    </div>
  )
}

export function ResultBanner({
  result, state, onNext,
}: { result: HandResult; state: GameState; onNext: () => void }) {
  const names = result.winners.map((id) => state.players.find((p) => p.id === id)?.name ?? id)
  return (
    <div className="banner" data-testid="hand-result">
      <div className="banner__title">
        {names.length > 1 ? 'Ganan' : 'Gana'} {names.join(', ')}
      </div>
      <div>{result.hand_name} · Bote {result.pot}</div>
      {state.phase === 'hand_over' && (
        <button className="btn btn--primary" onClick={onNext}>Siguiente mano</button>
      )}
    </div>
  )
}

export function GameOver({
  winnerId, state, onAgain,
}: { winnerId: string; state: GameState | null; onAgain: () => void }) {
  const winner = state?.players.find((p) => p.id === winnerId)
  const human = winnerId === 'human'
  const btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { btnRef.current?.focus() }, [])
  return (
    <div className="overlay" data-testid="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="overlay__card">
        <h2 id="game-over-title">{human ? '¡Ganaste la partida!' : 'Fin de la partida'}</h2>
        <p>{human ? 'Eliminaste a todos los bots.' : `Ganador: ${winner?.name ?? winnerId}`}</p>
        <button ref={btnRef} className="btn btn--primary btn--big" onClick={onAgain}>Jugar de nuevo</button>
      </div>
    </div>
  )
}
