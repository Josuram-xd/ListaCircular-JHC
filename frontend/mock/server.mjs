// Servidor mock del contrato docs/API_CONTRACT.md (REST + WebSocket).
// Partida simulada simple: sin evaluador real de manos (el ganador del showdown es aleatorio).
import http from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8000)
const BOT_DELAY = Number(process.env.BOT_DELAY || 600)
const HAND_NAMES = ['Carta Alta', 'Pareja', 'Doble Pareja', 'Trio', 'Escalera', 'Color', 'Full House', 'Poker']
const RANKS = '23456789TJQKA'
const SUITS = 'SHDC'

const games = new Map()
let counter = 0

function newDeck() {
  const d = []
  for (const r of RANKS) for (const s of SUITS) d.push(r + s)
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function createGame(bots, chips) {
  const id = `m${(++counter).toString(36)}${Date.now().toString(36).slice(-3)}`
  const players = [{ id: 'human', name: 'Tú', is_bot: false, chips, bet: 0, status: 'active', cards: null }]
  for (let i = 1; i <= bots; i++) {
    players.push({ id: `bot${i}`, name: `Bot ${i}`, is_bot: true, chips, bet: 0, status: 'active', cards: null })
  }
  const g = {
    id, players, sockets: new Set(), phase: 'waiting', collected: 0, community: [], deck: [],
    currentBet: 0, minRaise: 0, dealerIdx: players.length - 1, turnIdx: null, handNumber: 0,
    bb: Math.max(1, Math.floor(chips / 100)) * 2, toAct: [], timer: null, showCards: false,
  }
  games.set(id, g)
  return g
}

const live = (g) => g.players.filter((p) => p.status !== 'out')
const inHand = (g) => g.players.filter((p) => p.status === 'active' || p.status === 'all_in')
const pot = (g) => g.collected + g.players.reduce((a, p) => a + p.bet, 0)

function maxBet(g) {
  const c = inHand(g).map((p) => p.chips + p.bet)
  return c.length ? Math.min(...c) : 0
}

function toState(g) {
  const turn = g.turnIdx === null ? null : g.players[g.turnIdx].id
  const dealer = g.players[g.dealerIdx]
  return {
    game_id: g.id, phase: g.phase, pot: pot(g), community: g.community,
    current_bet: g.currentBet, max_bet: maxBet(g), min_raise: g.currentBet + g.minRaise,
    dealer_id: dealer ? dealer.id : null, turn_id: turn, hand_number: g.handNumber,
    players: g.players.map((p) => ({
      id: p.id, name: p.name, is_bot: p.is_bot, chips: p.chips, bet: p.bet, status: p.status,
      cards: !p.is_bot || (g.showCards && (p.status === 'active' || p.status === 'all_in')) ? p.cards : null,
    })),
  }
}

function broadcast(g, msg) {
  const raw = JSON.stringify(msg)
  for (const ws of g.sockets) if (ws.readyState === 1) ws.send(raw)
}
const sendState = (g) => broadcast(g, { type: 'state', state: toState(g) })

function nextIdx(g, from, pred = (p) => p.status !== 'out') {
  const n = g.players.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (pred(g.players[i])) return i
  }
  return from
}

function put(g, p, amount) {
  const a = Math.min(amount, p.chips)
  p.chips -= a
  p.bet += a
  if (p.chips === 0) p.status = 'all_in'
}

function startHand(g) {
  g.handNumber++
  g.deck = newDeck()
  g.community = []
  g.collected = 0
  g.showCards = false
  for (const p of g.players) {
    p.bet = 0
    if (p.status !== 'out') { p.status = 'active'; p.cards = [g.deck.pop(), g.deck.pop()] } else p.cards = null
  }
  g.dealerIdx = nextIdx(g, g.dealerIdx)
  const sb = nextIdx(g, g.dealerIdx)
  const bb = nextIdx(g, sb)
  put(g, g.players[sb], g.bb / 2)
  put(g, g.players[bb], g.bb)
  g.currentBet = g.bb
  g.minRaise = g.bb
  g.phase = 'preflop'
  const first = live(g).length === 2 ? sb : nextIdx(g, bb)
  beginRound(g, first)
}

function beginRound(g, firstIdx) {
  const n = g.players.length
  g.toAct = []
  for (let k = 0; k < n; k++) {
    const p = g.players[(firstIdx + k) % n]
    if (p.status === 'active') g.toAct.push(p.id)
  }
  advance(g)
}

/** Decide quién actúa o avanza de fase. */
function advance(g) {
  clearTimeout(g.timer)
  if (inHand(g).length === 1 && inHand(g)[0].status === 'active' || inHand(g).length <= 1) {
    return endHand(g, false)
  }
  const ableToAct = inHand(g).filter((p) => p.status === 'active')
  // ronda terminada o nadie puede actuar
  if (g.toAct.length === 0 || (ableToAct.length <= 1 && ableToAct.every((p) => p.bet >= g.currentBet))) {
    return nextPhase(g)
  }
  const p = g.players.find((x) => x.id === g.toAct[0])
  g.turnIdx = g.players.indexOf(p)
  sendState(g)
  if (p.is_bot) g.timer = setTimeout(() => botAct(g, p), BOT_DELAY)
}

function nextPhase(g) {
  for (const p of g.players) { g.collected += p.bet; p.bet = 0 }
  g.currentBet = 0
  g.minRaise = g.bb
  g.turnIdx = null
  const order = ['preflop', 'flop', 'turn', 'river']
  const i = order.indexOf(g.phase)
  if (i === 3) return endHand(g, true)
  g.phase = order[i + 1]
  g.deck.pop()
  const n = i === 0 ? 3 : 1
  for (let k = 0; k < n; k++) g.community.push(g.deck.pop())
  const canBet = inHand(g).filter((p) => p.status === 'active').length >= 2
  if (!canBet) {
    sendState(g)
    g.timer = setTimeout(() => nextPhase(g), BOT_DELAY)
    return
  }
  beginRound(g, nextIdx(g, g.dealerIdx, (p) => p.status === 'active'))
}

function endHand(g, showdown) {
  for (const p of g.players) { g.collected += p.bet; p.bet = 0 }
  const contenders = inHand(g)
  const winner = contenders[Math.floor(Math.random() * contenders.length)]
  const total = g.collected
  g.turnIdx = null
  g.showCards = showdown
  g.phase = showdown ? 'showdown' : 'hand_over'
  if (showdown) sendState(g)
  winner.chips += total
  g.collected = 0
  g.currentBet = 0
  for (const p of g.players) if (p.chips === 0 && p.status !== 'out') p.status = 'out'
  g.phase = 'hand_over'
  const reveal = {}
  if (showdown) for (const p of contenders) reveal[p.id] = p.cards
  const result = {
    type: 'hand_result', winners: [winner.id], pot: total,
    hand_name: showdown ? HAND_NAMES[Math.floor(Math.random() * HAND_NAMES.length)] : 'Todos se retiraron',
    showdown: reveal,
  }
  const send = () => {
    sendState(g)
    broadcast(g, result)
    const alive = live(g)
    if (g.players[0].status === 'out' || alive.length <= 1) {
      g.phase = 'game_over'
      sendState(g)
      broadcast(g, { type: 'game_over', winner_id: alive.length ? alive[0].id : winner.id })
    }
  }
  if (showdown) g.timer = setTimeout(send, 300)
  else send()
}

function applyAction(g, p, action, amount) {
  const toCall = Math.max(g.currentBet - p.bet, 0)
  const idx = g.toAct.indexOf(p.id)
  if (idx >= 0) g.toAct.splice(idx, 1)
  const reopen = (newTotal) => {
    const raiseBy = newTotal - g.currentBet
    if (raiseBy >= g.minRaise) g.minRaise = raiseBy
    g.currentBet = Math.max(g.currentBet, newTotal)
    g.toAct = []
    const n = g.players.length
    for (let k = 1; k < n; k++) {
      const q = g.players[(g.players.indexOf(p) + k) % n]
      if (q.status === 'active') g.toAct.push(q.id)
    }
  }
  let shown = amount
  if (action === 'fold') p.status = 'folded'
  else if (action === 'call') { put(g, p, toCall); shown = p.bet }
  else if (action === 'raise') {
    put(g, p, amount - p.bet)
    reopen(p.bet)
    shown = p.bet
  } else if (action === 'all_in') {
    put(g, p, p.chips)
    if (p.bet > g.currentBet) reopen(p.bet)
    shown = p.bet
  }
  return { shown, label: action === 'call' && toCall === 0 ? 'check' : action }
}

function botAct(g, p) {
  const toCall = Math.max(g.currentBet - p.bet, 0)
  const r = Math.random()
  let action = 'call'
  let amount
  const mb = maxBet(g)
  const minR = g.currentBet + g.minRaise
  if (toCall > 0 && r < 0.15) action = 'fold'
  else if (r > 0.9 && p.chips > toCall) action = 'all_in'
  else if (r > 0.7 && minR <= mb && p.chips + p.bet > minR) { action = 'raise'; amount = minR }
  const { shown, label } = applyAction(g, p, action, amount)
  broadcast(g, { type: 'bot_action', player_id: p.id, action: label, amount: shown })
  advance(g)
}

function handleClient(g, ws, raw) {
  const err = (code, message) => ws.send(JSON.stringify({ type: 'error', code, message }))
  let m
  try { m = JSON.parse(raw.toString()) } catch { return err('bad_message', 'JSON inválido') }
  if (!m || typeof m !== 'object') return err('bad_message', 'Mensaje inválido')
  if (m.type === 'next_hand') {
    if (g.phase !== 'hand_over') return err('illegal_action', 'No se puede iniciar otra mano ahora')
    return startHand(g)
  }
  if (m.type !== 'action') return err('bad_message', 'Tipo de mensaje desconocido')
  const p = g.players[0]
  if (g.turnIdx !== 0 || !['preflop', 'flop', 'turn', 'river'].includes(g.phase)) return err('not_your_turn', 'No es tu turno')
  if (!['fold', 'call', 'raise', 'all_in'].includes(m.action)) return err('illegal_action', 'Acción no válida')
  if (m.action === 'raise') {
    const mb = maxBet(g)
    const minR = g.currentBet + g.minRaise
    if (!Number.isInteger(m.amount) || m.amount < Math.min(minR, mb) || m.amount > mb) {
      return err('invalid_amount', `Monto debe estar entre ${Math.min(minR, mb)} y ${mb}`)
    }
  }
  clearTimeout(g.timer)
  applyAction(g, p, m.action, m.amount)
  advance(g)
}

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }
  const json = (code, body) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (req.method === 'POST' && url.pathname === '/games') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let d
      try { d = JSON.parse(body) } catch { return json(422, { detail: 'JSON inválido' }) }
      const ok = Number.isInteger(d.bots) && d.bots >= 1 && d.bots <= 8 && Number.isInteger(d.chips) && d.chips >= 100 && d.chips <= 100000
      if (!ok) return json(422, { detail: 'bots debe ser 1-8 y chips 100-100000' })
      json(201, { game_id: createGame(d.bots, d.chips).id })
    })
    return
  }
  const m = url.pathname.match(/^\/games\/([^/]+)$/)
  if (req.method === 'GET' && m) {
    const g = games.get(m[1])
    return g ? json(200, toState(g)) : json(404, { detail: 'Partida no encontrada' })
  }
  json(404, { detail: 'No encontrado' })
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/ws\/games\/([^/]+)$/)
  const g = m && games.get(m[1])
  if (!g) { socket.destroy(); return }
  wss.handleUpgrade(req, socket, head, (ws) => {
    g.sockets.add(ws)
    ws.on('close', () => g.sockets.delete(ws))
    ws.on('message', (raw) => handleClient(g, ws, raw))
    if (g.handNumber === 0) startHand(g)
    else sendState(g)
  })
})

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  server.listen(PORT, () => console.log(`Mock poker server en http://localhost:${PORT} (ws /ws/games/{id})`))
}
export { server }
