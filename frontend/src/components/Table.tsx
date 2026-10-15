import type { GameState } from '../types'
import Card from './Card'
import Seat from './Seat'

/** Posición (en %) del asiento i de n; el índice 0 (humano) va abajo y se avanza en sentido horario. */
export function seatPosition(i: number, n: number): { left: string; top: string } {
  const angle = Math.PI / 2 + (2 * Math.PI * i) / n
  const left = 50 + 42 * Math.cos(angle)
  const top = 50 + 40 * Math.sin(angle)
  return { left: `${left.toFixed(2)}%`, top: `${top.toFixed(2)}%` }
}

export const PHASE_LABEL: Record<string, string> = {
  waiting: 'Esperando',
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  hand_over: 'Fin de mano',
  game_over: 'Fin de partida',
}

export default function Table({ state }: { state: GameState }) {
  const n = state.players.length
  const slots = Array.from({ length: 5 }, (_, i) => state.community[i] ?? null)
  return (
    <div className="table">
      <div className="table__felt">
        <div className="table__center">
          <div className="pot" data-testid="pot">Bote: <strong>{state.pot}</strong></div>
          <div className="community">
            {slots.map((c, i) =>
              c ? <Card key={i} code={c} /> : <div key={i} className="card card--empty" />,
            )}
          </div>
          <div className="table__phase">Mano #{state.hand_number} · {PHASE_LABEL[state.phase] ?? state.phase}</div>
        </div>
      </div>
      {state.players.map((p, i) => (
        <Seat
          key={p.id}
          player={p}
          isDealer={state.dealer_id === p.id}
          isTurn={state.turn_id === p.id}
          style={{ ...seatPosition(i, n), position: 'absolute' }}
        />
      ))}
    </div>
  )
}
