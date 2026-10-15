export type Phase =
  | 'waiting' | 'preflop' | 'flop' | 'turn' | 'river'
  | 'showdown' | 'hand_over' | 'game_over'
export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'out'
export type ActionName = 'fold' | 'call' | 'raise' | 'all_in'

export interface Player {
  id: string
  name: string
  is_bot: boolean
  chips: number
  bet: number
  status: PlayerStatus
  cards: string[] | null
}

export interface GameState {
  game_id: string
  phase: Phase
  pot: number
  community: string[]
  current_bet: number
  max_bet: number
  min_raise: number
  dealer_id: string | null
  turn_id: string | null
  hand_number: number
  players: Player[]
}

export type ServerMessage =
  | { type: 'state'; state: GameState }
  | { type: 'bot_action'; player_id: string; action: ActionName | 'check'; amount?: number }
  | { type: 'hand_result'; winners: string[]; pot: number; hand_name: string; showdown: Record<string, string[]> }
  | { type: 'game_over'; winner_id: string }
  | { type: 'error'; code: string; message: string }

export type ClientMessage =
  | { type: 'action'; action: ActionName; amount?: number }
  | { type: 'next_hand' }

export interface HandResult {
  winners: string[]
  pot: number
  hand_name: string
  showdown: Record<string, string[]>
}
