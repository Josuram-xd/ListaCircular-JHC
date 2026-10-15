import { render, screen, fireEvent } from '@testing-library/react'
import { GameOver, ResultBanner } from './Overlays'
import { makeState } from '../test/fixtures'

describe('Overlays', () => {
  it('result banner shows winner and next hand button', () => {
    const onNext = vi.fn()
    render(
      <ResultBanner
        state={makeState({ phase: 'hand_over' })}
        result={{ winners: ['bot1'], pot: 340, hand_name: 'Pareja de Ases', showdown: {} }}
        onNext={onNext}
      />,
    )
    expect(screen.getByText(/Gana Bot 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pareja de Ases/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Siguiente mano'))
    expect(onNext).toHaveBeenCalled()
  })
  it('game over offers play again', () => {
    const onAgain = vi.fn()
    render(<GameOver winnerId="human" state={makeState()} onAgain={onAgain} />)
    fireEvent.click(screen.getByText('Jugar de nuevo'))
    expect(onAgain).toHaveBeenCalled()
  })
  it('game over is a modal dialog with initial focus on its button', () => {
    render(<GameOver winnerId="human" state={makeState()} onAgain={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Jugar de nuevo')).toHaveFocus()
  })
})
