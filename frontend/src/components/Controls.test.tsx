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
    const { rerender } = render(<Controls state={makeState()} send={send} />)
    const labels = ['Call 10', 'Fold', 'All-in', 'Raise a 40']
    labels.forEach((l) => {
      fireEvent.click(screen.getByText(l))
      rerender(<Controls state={makeState()} send={send} />)
    })
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      { type: 'action', action: 'call' },
      { type: 'action', action: 'fold' },
      { type: 'action', action: 'all_in' },
      { type: 'action', action: 'raise', amount: 40 },
    ])
  })
  it('disables buttons after acting until the next state', () => {
    const send = vi.fn()
    const { rerender } = render(<Controls state={makeState()} send={send} />)
    fireEvent.click(screen.getByText('Fold'))
    expect(screen.getByText('Fold')).toBeDisabled()
    fireEvent.click(screen.getByText('Fold'))
    expect(send).toHaveBeenCalledTimes(1)
    rerender(<Controls state={makeState()} send={send} />)
    expect(screen.getByText('Fold')).not.toBeDisabled()
  })
  it('disables raise when raising is illegal', () => {
    render(<Controls state={makeState({ max_bet: 20, current_bet: 20 })} send={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Raise a/ })).toBeDisabled()
  })
  it('lets the user type a raise amount freely and clamps on blur', () => {
    const send = vi.fn()
    render(<Controls state={makeState()} send={send} />)
    const input = screen.getByLabelText('Monto de subida (número)') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1' } })
    expect(input.value).toBe('1')
    fireEvent.change(input, { target: { value: '150' } })
    expect(input.value).toBe('150')
    fireEvent.blur(input)
    expect(input.value).toBe('150')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.blur(input)
    expect(input.value).toBe('40')
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
    fireEvent.blur(screen.getByLabelText('Monto de subida (número)'))
    fireEvent.click(screen.getByText('Raise a 1000'))
    expect(send).toHaveBeenCalledWith({ type: 'action', action: 'raise', amount: 1000 })
    expect(clampRaise(5, 40, 100)).toBe(40)
  })
})
