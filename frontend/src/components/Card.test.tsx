import { render, screen } from '@testing-library/react'
import Card, { parseCard } from './Card'

describe('Card', () => {
  it('parses ranks and suits', () => {
    expect(parseCard('TH')).toMatchObject({ rank: '10', red: true, sym: '♥' })
    expect(parseCard('AS')).toMatchObject({ rank: 'A', red: false })
    expect(parseCard('XX')).toBeNull()
  })
  it('renders red and black classes', () => {
    const { rerender } = render(<Card code="KD" />)
    expect(screen.getByTestId('card')).toHaveClass('card--red')
    rerender(<Card code="KC" />)
    expect(screen.getByTestId('card')).toHaveClass('card--black')
  })
  it('renders back when face down or null', () => {
    render(<Card code="KD" faceDown />)
    expect(screen.getByTestId('card-back')).toBeInTheDocument()
  })
})
