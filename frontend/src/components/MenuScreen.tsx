interface Props {
  onPlay: () => void
  onDemo: () => void
}

export default function MenuScreen({ onPlay, onDemo }: Props) {
  return (
    <nav className="setup menu" aria-label="Menú principal" data-testid="menu-screen">
      <h1>Poker Texas Hold'em</h1>
      <p className="setup__sub">Elige qué quieres hacer</p>
      <div className="menu__choices">
        <div className="menu__card">
          <span className="menu__icon" aria-hidden="true">♠</span>
          <p>Siéntate a la mesa y enfréntate a hasta ocho bots con fichas de verdad.</p>
          <button className="btn btn--primary btn--big" onClick={onPlay} data-testid="menu-play">Jugar póker</button>
        </div>
        <div className="menu__card menu__card--demo">
          <span className="menu__icon" aria-hidden="true">↻</span>
          <p>Mira cómo una lista circular doblemente enlazada reparte turnos y dealer.</p>
          <button className="btn btn--gold btn--big" onClick={onDemo} data-testid="menu-demo">Cómo funciona la lista circular</button>
        </div>
      </div>
    </nav>
  )
}
