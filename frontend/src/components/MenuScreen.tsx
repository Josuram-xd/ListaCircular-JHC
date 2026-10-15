interface Props {
  onPlay: () => void
  onDemo: () => void
}

export default function MenuScreen({ onPlay, onDemo }: Props) {
  return (
    <nav className="setup menu" aria-label="Menú principal" data-testid="menu-screen">
      <h1>Poker Texas Hold'em</h1>
      <p className="setup__sub">Elige qué quieres hacer</p>
      <button className="btn btn--primary btn--big" onClick={onPlay} data-testid="menu-play">Jugar póker</button>
      <button className="btn btn--gold btn--big" onClick={onDemo} data-testid="menu-demo">Cómo funciona la lista circular</button>
    </nav>
  )
}
