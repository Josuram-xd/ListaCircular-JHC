import { test, expect, type Page, type WebSocket, type TestInfo } from '@playwright/test'
import { snap } from './helpers'

interface Frame { type: string; [k: string]: unknown }

/**
 * Registra los mensajes del WebSocket de la partida para poder esperar la respuesta
 * del servidor después de cada clic (sin timeouts arbitrarios).
 */
class GameSocket {
  ws: WebSocket | null = null
  frames: Frame[] = []
  errors: Frame[] = []

  constructor(page: Page) {
    page.on('websocket', (ws) => {
      if (!ws.url().includes('/ws/games/')) return
      this.ws = ws
      ws.on('framereceived', ({ payload }) => {
        try {
          const f = JSON.parse(String(payload)) as Frame
          this.frames.push(f)
          if (f.type === 'error') this.errors.push(f)
        } catch { /* ignore */ }
      })
    })
  }

  /** Espera el siguiente `state` o `error` recibido después de este momento. */
  async nextReply(action: () => Promise<void>) {
    const ws = this.ws
    if (!ws) throw new Error('No hay WebSocket de partida')
    const reply = ws.waitForEvent('framereceived', {
      predicate: ({ payload }) => {
        try {
          const t = (JSON.parse(String(payload)) as Frame).type
          return t === 'state' || t === 'error'
        } catch { return false }
      },
      timeout: 15_000,
    })
    await action()
    await reply
  }
}

async function startGame(page: Page, bots: number, chips: number) {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
  await page.getByLabel(/Cantidad de bots/).fill(String(bots))
  await page.getByLabel(/Fichas iniciales/).fill(String(chips))
  await page.getByRole('button', { name: 'Jugar', exact: true }).click()
  await expect(page.getByTestId('pot')).toBeVisible()
  await expect(page.locator('[data-testid^="seat-"]')).toHaveCount(bots + 1)
}

/** Durante el turno del humano (fase de apuestas) las cartas de los bots van boca abajo. */
async function expectBotCardsHidden(page: Page, bots: number) {
  const human = page.getByTestId('seat-human')
  await expect(human.getByTestId('card')).toHaveCount(2)
  for (let i = 1; i <= bots; i++) {
    const seat = page.getByTestId(`seat-bot${i}`)
    await expect(seat.getByTestId('card')).toHaveCount(0)
  }
  // al menos un bot sigue en la mano y muestra sus dos dorsos
  const backs = await page.locator('[data-testid^="seat-bot"] [data-testid="card-back"]').count()
  expect(backs).toBeGreaterThanOrEqual(2)
  expect(backs % 2).toBe(0)
}

interface PlayResult { hands: number; actions: number; checkedTurns: number }

/**
 * Estrategia simple: en cada turno pulsa All-in (o Call/Check si All-in no está),
 * y "Siguiente mano" cuando aparece. Termina al ver la pantalla de game over.
 */
async function playUntilGameOver(
  page: Page, sock: GameSocket, bots: number, testInfo: TestInfo, opts: { maxSteps: number; shotPrefix?: string },
): Promise<PlayResult> {
  const gameOver = page.getByTestId('game-over')
  const controls = page.getByTestId('controls')
  const nextHand = page.getByRole('button', { name: 'Siguiente mano' }).first()
  const any = page.locator('[data-testid="game-over"], [data-testid="controls"]')
    .or(page.getByRole('button', { name: 'Siguiente mano' }))
  const res: PlayResult = { hands: 1, actions: 0, checkedTurns: 0 }
  let tableShot = !opts.shotPrefix

  for (let step = 0; step < opts.maxSteps; step++) {
    await any.first().waitFor({ state: 'visible', timeout: 15_000 })
    if (await gameOver.isVisible()) return res
    if (await controls.isVisible()) {
      await expect(page.locator('.table__phase')).toHaveText(/preflop|flop|turn|river/i)
      await expectBotCardsHidden(page, bots)
      res.checkedTurns++
      if (!tableShot) {
        await snap(page, testInfo, `${opts.shotPrefix}-table`)
        tableShot = true
      }
      const allIn = controls.getByRole('button', { name: 'All-in' })
      const call = controls.getByRole('button', { name: /^(Call \d+|Check)$/ })
      const btn = (await allIn.isEnabled()) ? allIn : call
      await sock.nextReply(() => btn.click())
      res.actions++
      continue
    }
    if (await nextHand.isVisible()) {
      await sock.nextReply(() => nextHand.click())
      res.hands++
    }
  }
  throw new Error(`No se llegó a game_over en ${opts.maxSteps} pasos (manos: ${res.hands})`)
}

async function expectGameOverAndRestart(page: Page) {
  const over = page.getByTestId('game-over')
  await expect(over).toBeVisible()
  await expect(over.getByRole('heading')).toHaveText(/¡Ganaste la partida!|Fin de la partida/)
  await over.getByRole('button', { name: 'Jugar de nuevo' }).click()
  await expect(over).toHaveCount(0)
  // vuelve a la pantalla de inicio (configuración)
  await expect(page.getByRole('button', { name: 'Jugar', exact: true })).toBeVisible()
  await expect(page.getByTestId('setup-back')).toBeVisible()
  await expect(page.getByLabel(/Cantidad de bots/)).toHaveValue('3')
}

for (const { bots, maxSteps, shots } of [
  { bots: 3, maxSteps: 1500, shots: true },
  { bots: 1, maxSteps: 1500, shots: false },
  { bots: 8, maxSteps: 1500, shots: false },
]) {
  test(`póker con ${bots} bot(s) y 100 fichas llega a game over y permite jugar de nuevo`, async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    const sock = new GameSocket(page)
    await startGame(page, bots, 100)
    const r = await playUntilGameOver(page, sock, bots, testInfo, { maxSteps, shotPrefix: shots ? '03-poker' : undefined })
    testInfo.annotations.push({ type: 'partida', description: `manos=${r.hands} acciones=${r.actions}` })
    console.log(`[${bots} bots] manos=${r.hands} acciones=${r.actions}`)
    expect(r.actions).toBeGreaterThan(0)
    expect(r.checkedTurns).toBeGreaterThan(0)
    expect(sock.frames.some((f) => f.type === 'game_over')).toBe(true)
    // la estrategia nunca debe provocar errores del servidor (no es tu turno, acción ilegal...)
    expect(sock.errors, JSON.stringify(sock.errors)).toEqual([])
    if (shots) await snap(page, testInfo, '04-game-over')
    await expectGameOverAndRestart(page)
  })
}
