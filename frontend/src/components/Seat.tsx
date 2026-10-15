import type { Player } from '../types'
import Card from './Card'

interface Props {
  player: Player
  isDealer: boolean
  isTurn: boolean
  style?: React.CSSProperties
}

const STATUS_LABEL: Record<string, string> = {
  folded: 'Retirado',
  all_in: 'All-in',
  out: 'Eliminado',
}

export default function Seat({ player, isDealer, isTurn, style }: Props) {
  const dim = player.status === 'folded' || player.status === 'out'
  const showCards = player.status !== 'out' && player.status !== 'folded'
  const cls = [
    'seat',
    dim ? 'seat--dim' : '',
    isTurn ? 'seat--turn' : '',
    player.status === 'all_in' ? 'seat--allin' : '',
    !player.is_bot ? 'seat--human' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} style={style} aria-current={isTurn ? 'true' : undefined} data-testid={`seat-${player.id}`}>
      {showCards && (
        <div className="seat__cards">
          {player.cards && player.cards.length > 0
            ? player.cards.map((c, i) => <Card key={i} code={c} small={player.is_bot} />)
            : [0, 1].map((i) => <Card key={i} faceDown small />)}
        </div>
      )}
      <div className="seat__info">
        <div className="seat__name">
          {player.name}
          {isDealer && <span className="dealer-btn" title="Dealer" data-testid="dealer-btn">D</span>}
        </div>
        <div className="seat__chips">{player.chips} fichas</div>
        {STATUS_LABEL[player.status] && (
          <div className={`seat__status seat__status--${player.status}`}>{STATUS_LABEL[player.status]}</div>
        )}
      </div>
      {player.bet > 0 && player.status !== 'out' && (
        <div className="seat__bet" data-testid={`bet-${player.id}`}>{player.bet}</div>
      )}
    </div>
  )
}
