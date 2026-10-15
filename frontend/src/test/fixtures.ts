import type { GameState } from '../types'

export function makeState(over: Partial<GameState> = {}): GameState {
  return {
    game_id: 'g1', phase: 'preflop', pot: 30, community: ['AH', '7D', '2C'],
    current_bet: 20, max_bet: 1000, min_raise: 40, dealer_id: 'bot1', turn_id: 'human',
    hand_number: 1,
    players: [
      { id: 'human', name: 'Tú', is_bot: false, chips: 980, bet: 10, status: 'active', cards: ['KS', 'QS'] },
      { id: 'bot1', name: 'Bot 1', is_bot: true, chips: 1000, bet: 20, status: 'active', cards: null },
      { id: 'bot2', name: 'Bot 2', is_bot: true, chips: 500, bet: 0, status: 'folded', cards: null },
      { id: 'bot3', name: 'Bot 3', is_bot: true, chips: 0, bet: 0, status: 'out', cards: null },
    ],
    ...over,
  }
}
