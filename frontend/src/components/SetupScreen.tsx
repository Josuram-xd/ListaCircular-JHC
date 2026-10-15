import { useState } from 'react'

interface Props {
  onPlay: (bots: number, chips: number) => void
  loading?: boolean
  error?: string | null
}

export const BOTS_MIN = 1
export const BOTS_MAX = 8
export const CHIPS_MIN = 100
export const CHIPS_MAX = 100000

export default function SetupScreen({ onPlay, loading, error }: Props) {
  const [bots, setBots] = useState(3)
  const [chips, setChips] = useState(1000)

  const botsOk = Number.isInteger(bots) && bots >= BOTS_MIN && bots <= BOTS_MAX
  const chipsOk = Number.isInteger(chips) && chips >= CHIPS_MIN && chips <= CHIPS_MAX

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault()
        if (botsOk && chipsOk) onPlay(bots, chips)
      }}
    >
      <h1>Poker Texas Hold'em</h1>
      <p className="setup__sub">Juega contra bots</p>
      <label>
        Cantidad de bots ({BOTS_MIN}-{BOTS_MAX})
        <input
          type="number"
          min={BOTS_MIN}
          max={BOTS_MAX}
          value={Number.isNaN(bots) ? '' : bots}
          onChange={(e) => setBots(e.target.valueAsNumber)}
        />
      </label>
      {!botsOk && <div className="field-error" role="alert">Debe ser entre {BOTS_MIN} y {BOTS_MAX}</div>}
      <label>
        Fichas iniciales ({CHIPS_MIN}-{CHIPS_MAX})
        <input
          type="number"
          min={CHIPS_MIN}
          max={CHIPS_MAX}
          step={100}
          value={Number.isNaN(chips) ? '' : chips}
          onChange={(e) => setChips(e.target.valueAsNumber)}
        />
      </label>
      {!chipsOk && <div className="field-error" role="alert">Debe ser entre {CHIPS_MIN} y {CHIPS_MAX}</div>}
      {error && <div className="field-error" role="alert">{error}</div>}
      <button className="btn btn--primary btn--big" type="submit" disabled={!botsOk || !chipsOk || loading}>
        {loading ? 'Creando…' : 'Jugar'}
      </button>
    </form>
  )
}
