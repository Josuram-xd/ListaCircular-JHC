import { render, screen } from '@testing-library/react'
import Table, { seatPosition } from './Table'
import { makeState } from '../test/fixtures'

describe('Table', () => {
  it('puts the human at the bottom', () => {
    const p = seatPosition(0, 4)
    expect(parseFloat(p.left)).toBeCloseTo(50)
    expect(parseFloat(p.top)).toBeGreaterThan(50)
  })
  it('renders dealer, bets, pot, community, hidden bot cards', () => {
    render(<Table state={makeState()} />)
    expect(screen.getAllByTestId('dealer-btn')).toHaveLength(1)
    expect(screen.getByTestId('seat-bot1')).toContainElement(screen.getByTestId('dealer-btn'))
    expect(screen.getByTestId('bet-bot1')).toHaveTextContent('20')
    expect(screen.getByTestId('pot')).toHaveTextContent('30')
    expect(screen.getAllByTestId('card')).toHaveLength(3 + 2)
    expect(screen.getByTestId('seat-bot1').querySelectorAll('[data-testid=card-back]')).toHaveLength(2)
    expect(screen.getByTestId('seat-bot2')).toHaveClass('seat--dim')
    expect(screen.getByTestId('seat-human')).toHaveClass('seat--turn')
  })
  it('reveals bot cards when provided', () => {
    const s = makeState({ phase: 'showdown', turn_id: null })
    s.players[1].cards = ['AS', 'AD']
    render(<Table state={s} />)
    expect(screen.getAllByTestId('card')).toHaveLength(3 + 2 + 2)
  })
})
