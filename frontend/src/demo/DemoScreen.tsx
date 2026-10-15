import { useCallback, useEffect, useState } from 'react'
import CircularListView from './CircularListView'
import { createDemoList, demoOp } from './demoApi'
import type { DemoOp, DemoState } from './types'

export const EXAMPLE_NAMES = ['Ana', 'Luis', 'Eva', 'Marta']

interface Props {
  onBack: () => void
}

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Error de conexión')

export default function DemoScreen({ onBack }: Props) {
  const [state, setState] = useState<DemoState | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = useCallback(async (names: string[]) => {
    setBusy(true)
    setError(null)
    try {
      setState(await createDemoList(names))
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    createDemoList([])
      .then((s) => { if (!cancelled) setState(s) })
      .catch((e) => { if (!cancelled) setError(msg(e)) })
    return () => { cancelled = true }
  }, [])

  const run = async (op: DemoOp): Promise<boolean> => {
    if (!state) return false
    setBusy(true)
    setError(null)
    try {
      setState(await demoOp(state.list_id, op))
      return true
    } catch (e) {
      setError(msg(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const insert = async (where: 'start' | 'end' | 'after_pointer') => {
    if (await run({ op: 'insert', name: name.trim(), where })) setName('')
  }

  const trimmed = name.trim()
  const off = busy || !state
  const empty = !state || state.size === 0

  return (
    <section className="demo" data-testid="demo-screen">
      <header className="demo__head">
        <button className="btn" onClick={onBack} data-testid="demo-back">← Volver al menú</button>
        <h1>Cómo funciona la lista circular</h1>
      </header>

      <div className="demo__intro">
        <p>
          Una <strong>lista circular doblemente enlazada</strong> es una cadena de nodos donde cada uno guarda
          una referencia al <span className="c-next">siguiente</span> y al <span className="c-prev">anterior</span>;
          el último nodo apunta de vuelta al primero (la cabeza), así que no tiene final: se puede dar vueltas sin parar
          en cualquier sentido.
        </p>
        <p>
          En la mesa de póker los jugadores son esos nodos: el <strong>dealer</strong> es un puntero que avanza una
          posición por mano, las <strong>ciegas</strong> son los dos nodos siguientes al dealer, los <strong>turnos</strong> se
          reparten con <code>siguiente</code> hasta cerrar la ronda, y cuando un jugador es <strong>eliminado</strong> basta
          con reenlazar su anterior con su siguiente.
        </p>
      </div>

      <div className="demo__layout">
        <div className="demo__canvas">
          <CircularListView state={state} onNodeClick={(n) => { if (!busy) void run({ op: 'remove', name: n }) }} />
          <ul className="legend" aria-label="Leyenda">
            <li><span className="legend__sw legend__sw--next" /> siguiente</li>
            <li><span className="legend__sw legend__sw--prev" /> anterior</li>
            <li><span className="legend__sw legend__sw--head" /> HEAD (cabeza)</li>
            <li><span className="legend__sw legend__sw--ptr" /> puntero actual</li>
          </ul>
          <p className="demo__hint">Haz clic en un nodo para eliminarlo.</p>
        </div>

        <div className="demo__side">
          <form className="demo__form" onSubmit={(e) => { e.preventDefault(); if (trimmed && !off) void insert('end') }}>
            <label>
              Nombre del nodo
              <input
                value={name}
                maxLength={12}
                placeholder="Ej. Marta"
                onChange={(e) => setName(e.target.value)}
                data-testid="demo-name-input"
              />
            </label>
            <div className="demo__btns">
              <button type="button" className="btn" disabled={off || !trimmed} onClick={() => void insert('start')} data-testid="demo-insert-start">Insertar al inicio</button>
              <button type="button" className="btn" disabled={off || !trimmed} onClick={() => void insert('end')} data-testid="demo-insert-end">Insertar al final</button>
              <button type="button" className="btn" disabled={off || !trimmed} onClick={() => void insert('after_pointer')} data-testid="demo-insert-after">Insertar después del puntero</button>
              <button type="button" className="btn btn--danger" disabled={off || !trimmed} onClick={() => void run({ op: 'remove', name: trimmed })} data-testid="demo-remove">Eliminar</button>
            </div>
            <div className="demo__btns">
              <button type="button" className="btn" disabled={off || empty} onClick={() => void run({ op: 'retreat' })} data-testid="demo-retreat">◀ Retroceder</button>
              <button type="button" className="btn" disabled={off || empty} onClick={() => void run({ op: 'advance' })} data-testid="demo-advance">Avanzar ▶</button>
              <button type="button" className="btn" disabled={off || empty} onClick={() => void run({ op: 'lap' })} data-testid="demo-lap">Dar una vuelta</button>
            </div>
            <div className="demo__btns">
              <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void create(EXAMPLE_NAMES)} data-testid="demo-example">Ejemplo con 4 nodos</button>
              <button type="button" className="btn" disabled={off} onClick={() => void run({ op: 'reset' })} data-testid="demo-reset">Reiniciar</button>
            </div>
          </form>

          {error && <div className="demo__error" role="alert" data-testid="demo-error">{error}</div>}

          <div className="demo__steps" data-testid="demo-steps">
            <h2>Qué pasó</h2>
            {state && state.steps.length > 0 ? (
              <ol>
                {state.steps.map((s, i) => <li key={`${i}-${s}`} data-testid="demo-step">{s}</li>)}
              </ol>
            ) : (
              <p className="demo__muted">Haz una operación para ver cómo cambian los enlaces.</p>
            )}
          </div>

          <table className="demo__table" data-testid="demo-table">
            <caption>Enlaces de cada nodo</caption>
            <thead><tr><th>Nodo</th><th>anterior</th><th>siguiente</th></tr></thead>
            <tbody>
              {(state?.nodes ?? []).map((n) => (
                <tr key={n.name} data-testid={`demo-row-${n.name}`}>
                  <td>{n.name}{n.is_head ? ' (HEAD)' : ''}{n.is_pointer ? ' ●' : ''}</td>
                  <td>{n.prev}</td>
                  <td>{n.next}</td>
                </tr>
              ))}
              {(state?.nodes.length ?? 0) === 0 && <tr><td colSpan={3} className="demo__muted">Sin nodos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
