import { render, screen, fireEvent } from '@testing-library/react'
import SetupScreen from './SetupScreen'

describe('SetupScreen', () => {
  it('submits valid values', () => {
    const onPlay = vi.fn()
    render(<SetupScreen onPlay={onPlay} />)
    fireEvent.click(screen.getByText('Jugar'))
    expect(onPlay).toHaveBeenCalledWith(3, 1000)
  })
  it('blocks invalid values', () => {
    const onPlay = vi.fn()
    render(<SetupScreen onPlay={onPlay} />)
    fireEvent.change(screen.getByLabelText(/Cantidad de bots/), { target: { value: '12' } })
    expect(screen.getByText('Jugar')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Cantidad de bots/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Fichas iniciales/), { target: { value: '50' } })
    expect(screen.getByText('Jugar')).toBeDisabled()
    expect(onPlay).not.toHaveBeenCalled()
  })
})
