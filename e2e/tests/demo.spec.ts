import { test, expect, type Page } from '@playwright/test'
import { snap } from './helpers'

/** Comprueba el gráfico y la tabla: orden desde la cabeza, enlaces circulares, cabeza y puntero. */
async function expectList(page: Page, order: string[], pointer: string | null) {
  const nodes = page.locator('[data-testid^="demo-node-"]')
  await expect(nodes).toHaveCount(order.length)
  const rows = page.locator('[data-testid="demo-table"] tbody tr[data-testid^="demo-row-"]')
  await expect(rows).toHaveCount(order.length)
  if (order.length === 0) {
    await expect(page.getByTestId('demo-empty')).toBeVisible()
    await expect(page.getByTestId('demo-self-loop')).toHaveCount(0)
    await expect(page.getByTestId('demo-table')).toContainText('Sin nodos')
    return
  }
  await expect(page.getByTestId('demo-empty')).toHaveCount(0)
  await expect(page.getByTestId('demo-self-loop')).toHaveCount(order.length === 1 ? 1 : 0)
  await expect(page.getByTestId('demo-graph')).toHaveAttribute('aria-label', `Lista circular con ${order.length} nodos`)
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual(
    order.map((n) => `demo-row-${n}`),
  )
  for (let i = 0; i < order.length; i++) {
    const name = order[i]
    const node = page.getByTestId(`demo-node-${name}`)
    await expect(node).toHaveAttribute('data-head', i === 0 ? 'true' : 'false')
    await expect(node).toHaveAttribute('data-pointer', name === pointer ? 'true' : 'false')
    const prev = order[(i - 1 + order.length) % order.length]
    const next = order[(i + 1) % order.length]
    const cells = page.getByTestId(`demo-row-${name}`).locator('td')
    await expect(cells.nth(1)).toHaveText(prev)
    await expect(cells.nth(2)).toHaveText(next)
    if (order.length >= 2) {
      await expect(page.getByTestId(`demo-next-${name}`)).toHaveCount(1)
      await expect(page.getByTestId(`demo-prev-${name}`)).toHaveCount(1)
    }
  }
}

/** Ejecuta una operación, espera la respuesta de /ops y verifica que el panel "Qué pasó" cambió. */
async function op(page: Page, action: () => Promise<void>, expectStep?: string | RegExp, status = 200) {
  const steps = page.getByTestId('demo-steps')
  const before = await steps.innerText()
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/demo/lists/') && r.url().endsWith('/ops') && r.request().method() === 'POST'),
    action(),
  ])
  expect(res.status()).toBe(status)
  if (status === 200) {
    await expect(page.getByTestId('demo-error')).toHaveCount(0)
    await expect(steps).not.toHaveText(before)
    expect(await page.getByTestId('demo-step').count()).toBeGreaterThan(0)
    if (expectStep) await expect(steps).toContainText(expectStep)
  } else {
    await expect(page.getByTestId('demo-error')).toBeVisible()
  }
}

async function typeName(page: Page, name: string) {
  await page.getByTestId('demo-name-input').fill(name)
}

test.describe('Demo de la lista circular', () => {
  // el anillo del puntero gira sin parar (clist-spin) y el nodo nunca está "estable" para un clic;
  // la app desactiva la animación con prefers-reduced-motion.
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('menu-demo').click()
    await expect(page.getByTestId('demo-screen')).toBeVisible()
    // la demo arranca con una lista vacía creada en el backend
    await expect(page.getByTestId('demo-empty')).toBeVisible()
    await expect(page.getByTestId('demo-advance')).toBeDisabled()
  })

  test('recorre inserciones, movimientos, eliminaciones y errores', async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    const input = page.getByTestId('demo-name-input')

    // --- ejemplo con 4 nodos ---
    await page.getByTestId('demo-example').click()
    await expectList(page, ['Ana', 'Luis', 'Eva', 'Marta'], 'Ana')
    await snap(page, testInfo, '05-demo-example')

    // --- inserciones ---
    await typeName(page, 'Zoe')
    await op(page, () => page.getByTestId('demo-insert-start').click(), 'Zoe pasa a ser la nueva cabeza')
    await expect(input).toHaveValue('')
    await expectList(page, ['Zoe', 'Ana', 'Luis', 'Eva', 'Marta'], 'Ana')
    await expect(page.getByTestId('demo-node-Zoe')).toHaveAttribute('data-highlight', 'true')

    await typeName(page, 'Pablo')
    await op(page, () => page.getByTestId('demo-insert-end').click(), 'Pablo queda como último nodo')
    await expectList(page, ['Zoe', 'Ana', 'Luis', 'Eva', 'Marta', 'Pablo'], 'Ana')

    await typeName(page, 'Iris')
    await op(page, () => page.getByTestId('demo-insert-after').click(), 'Iris.anterior = Ana')
    await expectList(page, ['Zoe', 'Ana', 'Iris', 'Luis', 'Eva', 'Marta', 'Pablo'], 'Ana')

    // Enter en el formulario inserta al final
    await typeName(page, 'Tom')
    await op(page, () => input.press('Enter'), 'Tom queda como último nodo')
    await expectList(page, ['Zoe', 'Ana', 'Iris', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom'], 'Ana')

    const full = ['Zoe', 'Ana', 'Iris', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom']

    // --- avanzar / retroceder / vuelta ---
    await op(page, () => page.getByTestId('demo-advance').click(), 'el puntero pasa a Iris')
    await expectList(page, full, 'Iris')
    await op(page, () => page.getByTestId('demo-retreat').click(), 'el puntero pasa a Ana')
    await op(page, () => page.getByTestId('demo-retreat').click(), 'el puntero pasa a Zoe')
    await expectList(page, full, 'Zoe')
    await op(page, () => page.getByTestId('demo-retreat').click(), 'Zoe es la cabeza: su anterior es el último nodo')
    await expectList(page, full, 'Tom')
    await op(page, () => page.getByTestId('demo-advance').click(), 'Tom era el último')
    await expectList(page, full, 'Zoe')

    await op(page, () => page.getByTestId('demo-lap').click(), 'vuelta completa')
    await expect(page.getByTestId('demo-step')).toHaveCount(full.length + 2)
    await expectList(page, full, 'Zoe')
    for (const n of full) await expect(page.getByTestId(`demo-node-${n}`)).toHaveAttribute('data-highlight', 'true')

    // --- eliminar cabeza (con el puntero en otro nodo) ---
    await op(page, () => page.getByTestId('demo-advance').click())
    await typeName(page, 'Zoe')
    await op(page, () => page.getByTestId('demo-remove').click(), 'Zoe era la cabeza: la cabeza pasa a Ana')
    await expectList(page, ['Ana', 'Iris', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom'], 'Ana')

    // --- eliminar el nodo del puntero (clic en el nodo) ---
    await op(page, () => page.getByTestId('demo-advance').click())
    await expectList(page, ['Ana', 'Iris', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom'], 'Iris')
    await op(page, () => page.getByTestId('demo-node-Iris').click(), 'el puntero pasa a Luis')
    await expectList(page, ['Ana', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom'], 'Luis')

    // --- errores ---
    await typeName(page, 'Luis')
    await op(page, () => page.getByTestId('demo-insert-end').click(), undefined, 422)
    await expect(page.getByTestId('demo-error')).toContainText("Ya existe un nodo llamado 'Luis'")
    await expect(input).toHaveValue('Luis') // un insert fallido no borra el nombre
    await expectList(page, ['Ana', 'Luis', 'Eva', 'Marta', 'Pablo', 'Tom'], 'Luis')

    await typeName(page, 'Nadie')
    await op(page, () => page.getByTestId('demo-remove').click(), undefined, 422)
    await expect(page.getByTestId('demo-error')).toContainText("No existe un nodo llamado 'Nadie'")

    // un nombre con espacios alrededor se recorta; nombre duplicado tras recorte también falla
    await typeName(page, '  Eva  ')
    await op(page, () => page.getByTestId('demo-insert-start').click(), undefined, 422)
    await expect(page.getByTestId('demo-error')).toContainText("Ya existe un nodo llamado 'Eva'")

    // --- eliminar hasta dejar 1 nodo ---
    for (const n of ['Ana', 'Eva', 'Marta', 'Tom']) {
      await typeName(page, n)
      await op(page, () => page.getByTestId('demo-remove').click(), `${n} queda aislado`)
    }
    await expectList(page, ['Luis', 'Pablo'], 'Luis')
    await op(page, () => page.getByTestId('demo-node-Pablo').click(), 'Luis.anterior = Luis: el nodo restante se apunta a sí mismo')
    await expectList(page, ['Luis'], 'Luis')
    await expect(page.getByTestId('demo-self-loop')).toBeVisible()
    await snap(page, testInfo, '06-demo-self-loop')
    await op(page, () => page.getByTestId('demo-advance').click(), 'no se mueve')
    await expectList(page, ['Luis'], 'Luis')

    // --- eliminar el último: lista vacía ---
    await op(page, () => page.getByTestId('demo-node-Luis').click(), 'La lista queda vacía')
    await expectList(page, [], null)
    for (const id of ['demo-advance', 'demo-retreat', 'demo-lap']) await expect(page.getByTestId(id)).toBeDisabled()

    // operación sobre lista vacía -> error del backend
    await typeName(page, 'Luis')
    await op(page, () => page.getByTestId('demo-remove').click(), undefined, 422)
    await expect(page.getByTestId('demo-error')).toContainText('La lista está vacía')
    await expectList(page, [], null)

    // insertar en lista vacía (después del puntero) crea el lazo a sí mismo
    await typeName(page, 'Solo')
    await op(page, () => page.getByTestId('demo-insert-after').click(), 'el único nodo se apunta a sí mismo')
    await expectList(page, ['Solo'], 'Solo')

    // segundo nodo: ambos se apuntan entre sí
    await typeName(page, 'Dos')
    await op(page, () => page.getByTestId('demo-insert-start').click(), 'ahora Solo y Dos se apuntan entre sí')
    await expectList(page, ['Dos', 'Solo'], 'Solo')

    // --- reiniciar ---
    await op(page, () => page.getByTestId('demo-reset').click(), 'Se descartan los 2 nodo(s)')
    await expectList(page, [], null)
    await op(page, () => page.getByTestId('demo-reset').click(), 'La lista ya estaba vacía')
  })

  test('valida el máximo de 12 nodos', async ({ page }) => {
    await page.getByTestId('demo-example').click()
    await expectList(page, ['Ana', 'Luis', 'Eva', 'Marta'], 'Ana')
    for (let i = 1; i <= 8; i++) {
      await typeName(page, `N${i}`)
      await op(page, () => page.getByTestId('demo-insert-end').click())
    }
    await expect(page.locator('[data-testid^="demo-node-"]')).toHaveCount(12)
    await typeName(page, 'N9')
    await op(page, () => page.getByTestId('demo-insert-end').click(), undefined, 422)
    await expect(page.getByTestId('demo-error')).toContainText('máximo de 12 nodos')
    await expect(page.locator('[data-testid^="demo-node-"]')).toHaveCount(12)
  })

  test('el botón Eliminar e insertar están deshabilitados sin nombre', async ({ page }) => {
    for (const id of ['demo-insert-start', 'demo-insert-end', 'demo-insert-after', 'demo-remove']) {
      await expect(page.getByTestId(id)).toBeDisabled()
    }
    await typeName(page, '   ')
    await expect(page.getByTestId('demo-insert-end')).toBeDisabled()
    await typeName(page, 'Ana')
    await expect(page.getByTestId('demo-insert-end')).toBeEnabled()
  })
})
