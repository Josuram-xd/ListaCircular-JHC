import { useState } from 'react'
import { createGame } from './api'
import { useGameSocket } from './useGameSocket'
import SetupScreen from './components/SetupScreen'
import Table from './components/Table'
import Controls from './components/Controls'
import { ActionLog, GameOver, ResultBanner, ToastStack } from './components/Overlays'

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { client, status, send, dismissToast } = useGameSocket(gameId)

  const play = async (bots: number, chips: number) => {
    setLoading(true)
    setError(null)
    try {
      setGameId(await createGame(bots, chips))
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo crear la partida')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setGameId(null); setError(null) }

  if (!gameId) {
    return <main className="app"><SetupScreen onPlay={play} loading={loading} error={error} /></main>
  }

  const { state } = client
  return (
    <main className="app">
      {status !== 'open' && (
        <div className="conn" role="alert">
          {status === 'closed'
            ? <>Conexión perdida. <button className="btn" onClick={reset}>Volver al inicio</button></>
            : status === 'reconnecting' ? 'Reconectando…' : 'Conectando…'}
        </div>
      )}
      {state ? (
        <>
          <Table state={state} />
          <div className="bottom">
            <div className="bottom__main">
              {client.result && (
                <ResultBanner result={client.result} state={state} onNext={() => send({ type: 'next_hand' })} />
              )}
              {!client.result && state.phase === 'hand_over' && (
                <button className="btn btn--primary" onClick={() => send({ type: 'next_hand' })}>Siguiente mano</button>
              )}
              <Controls state={state} send={send} />
            </div>
            <ActionLog log={client.log} />
          </div>
        </>
      ) : <div className="loading">Cargando partida…</div>}
      <ToastStack toasts={client.toasts} onDismiss={dismissToast} />
      {client.gameOverWinner && <GameOver winnerId={client.gameOverWinner} state={state} onAgain={reset} />}
    </main>
  )
}
