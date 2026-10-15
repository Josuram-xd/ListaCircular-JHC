const SUITS: Record<string, { sym: string; red: boolean }> = {
  S: { sym: '♠', red: false },
  H: { sym: '♥', red: true },
  D: { sym: '♦', red: true },
  C: { sym: '♣', red: false },
}

export function parseCard(code: string): { rank: string; suit: string; red: boolean; sym: string } | null {
  if (typeof code !== 'string' || code.length !== 2) return null
  const rank = code[0].toUpperCase()
  const s = SUITS[code[1].toUpperCase()]
  if (!s || !'23456789TJQKA'.includes(rank)) return null
  return { rank: rank === 'T' ? '10' : rank, suit: code[1].toUpperCase(), red: s.red, sym: s.sym }
}

interface Props {
  code?: string | null
  faceDown?: boolean
  small?: boolean
}

export default function Card({ code, faceDown, small }: Props) {
  const size = small ? ' card--small' : ''
  const parsed = !faceDown && code ? parseCard(code) : null
  if (!parsed) {
    return <div className={`card card--back${size}`} data-testid="card-back" role="img" aria-label="Carta oculta" />
  }
  return (
    <div
      className={`card ${parsed.red ? 'card--red' : 'card--black'}${size}`}
      role="img"
      aria-label={`${parsed.rank} de ${parsed.sym}`}
      data-testid="card"
      data-sym={parsed.sym}
    >
      <span className="card__rank">{parsed.rank}</span>
      <span className="card__suit">{parsed.sym}</span>
    </div>
  )
}
