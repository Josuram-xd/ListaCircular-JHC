import { render, screen, fireEvent } from '@testing-library/react'
import Controls, { clampRaise } from './Controls'
import { makeState } from '../test/fixtures'

describe('Controls', () => {
  it('is hidden when not human turn', () => {
    render(<Controls state={makeState({ turn_id: 'bot1' })} send={vi.fn()} />)
    expect(screen.queryByTestId('controls')).toBeNull()
  })
  it('shows call amount and sends actions', () => {
    const send = vi.fn()
    render(<Controls state={makeState()} send={send} />)
    fireEvent.click(screen.getByText('Call 10'))
    fireEvent.click(screen.getByText('Fold'))
    fireEvent.click(screen.getByText('All-in'))
    fireEvent.click(screen.getByText('Raise a 40'))
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      { type: 'action', action: 'call' },
      { type: 'action', action: 'fold' },
      { type: 'action', action: 'all_in' },
      { type: 'action', action: 'raise', amount: 40 },
    ])
  })
  it('shows Check when nothing to call', () => {
    const s = makeState()
    s.players[0].bet = 20
    render(<Controls state={s} send={vi.fn()} />)
    expect(screen.getByText('Check')).toBeInTheDocument()
  })
  it('clamps raise within bounds', () => {
    const send = vi.fn()
    render(<Controls state={makeState()} send={send} />)
    fireEvent.change(screen.getByLabelText('Monto de subida (número)'), { target: { value: '99999' } })
    fireEvent.click(screen.getByText('Raise a 1000'))
    expect(send).toHaveBeenCalledWith({ type: 'action', action: 'raise', amount: 1000 })
    expect(clampRaise(5, 40, 100)).toBe(40)
  })
})
