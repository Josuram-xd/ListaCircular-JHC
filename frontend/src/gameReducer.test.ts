import { clientReducer, initialClientState, describeBotAction } from './gameReducer'
import { makeState } from './test/fixtures'

describe('clientReducer', () => {
  it('replaces state with the full state received', () => {
    const a = clientReducer(initialClientState, { type: 'state', state: makeState({ pot: 10 }) })
    const b = clientReducer(a, { type: 'state', state: makeState({ pot: 99, community: [] }) })
    expect(b.state?.pot).toBe(99)
    expect(b.state?.community).toEqual([])
  })
  it('logs bot actions with player names', () => {
    const a = clientReducer(initialClientState, { type: 'state', state: makeState() })
    const b = clientReducer(a, { type: 'bot_action', player_id: 'bot1', action: 'raise', amount: 80 })
    expect(b.log[0].text).toBe('Bot 1 sube a 80')
  })
  it('stores hand result and clears it on a new hand', () => {
    let s = clientReducer(initialClientState, { type: 'state', state: makeState({ phase: 'hand_over' }) })
    s = clientReducer(s, { type: 'hand_result', winners: ['bot1'], pot: 40, hand_name: 'Pareja', showdown: {} })
    expect(s.result?.hand_name).toBe('Pareja')
    s = clientReducer(s, { type: 'state', state: makeState({ phase: 'preflop' }) })
    expect(s.result).toBeNull()
  })
  it('handles errors as toasts and dismiss', () => {
    let s = clientReducer(initialClientState, { type: 'error', code: 'not_your_turn', message: 'No es tu turno' })
    expect(s.toasts[0].text).toBe('No es tu turno')
    s = clientReducer(s, { type: 'dismiss_toast', id: s.toasts[0].id })
    expect(s.toasts).toHaveLength(0)
  })
  it('stores game over winner', () => {
    const s = clientReducer(initialClientState, { type: 'game_over', winner_id: 'human' })
    expect(s.gameOverWinner).toBe('human')
  })
  it('describes actions', () => {
    expect(describeBotAction('B', 'fold')).toBe('B se retira')
    expect(describeBotAction('B', 'all_in', 50)).toBe('B va all-in (50)')
  })
})
