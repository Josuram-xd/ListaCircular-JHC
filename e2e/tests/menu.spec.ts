import { test, expect } from '@playwright/test'
import { snap } from './helpers'

test.describe('Menú principal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('menu-screen')).toBeVisible()
  })

  test('muestra las dos opciones', async ({ page }, testInfo) => {
    await expect(page.getByTestId('menu-play')).toBeVisible()
    await expect(page.getByTestId('menu-play')).toHaveText('Jugar póker')
    await expect(page.getByTestId('menu-demo')).toBeVisible()
    await expect(page.getByTestId('menu-demo')).toHaveText('Cómo funciona la lista circular')
    await snap(page, testInfo, '01-menu')
  })

  test('vuelve al menú desde la configuración', async ({ page }, testInfo) => {
    await page.getByTestId('menu-play').click()
    await expect(page.getByRole('button', { name: 'Jugar', exact: true })).toBeVisible()
    await expect(page.getByTestId('menu-screen')).toHaveCount(0)
    await snap(page, testInfo, '02-setup')
    await page.getByTestId('setup-back').click()
    await expect(page.getByTestId('menu-screen')).toBeVisible()
  })

  test('vuelve al menú desde la mesa', async ({ page }) => {
    await page.getByTestId('menu-play').click()
    await page.getByRole('button', { name: 'Jugar', exact: true }).click()
    await expect(page.getByTestId('pot')).toBeVisible()
    await page.getByTestId('game-menu').click()
    await expect(page.getByTestId('menu-screen')).toBeVisible()
    // Al volver a entrar se muestra la configuración, no la partida anterior
    await page.getByTestId('menu-play').click()
    await expect(page.getByRole('button', { name: 'Jugar', exact: true })).toBeVisible()
  })

  test('vuelve al menú desde la demo', async ({ page }) => {
    await page.getByTestId('menu-demo').click()
    await expect(page.getByTestId('demo-screen')).toBeVisible()
    await page.getByTestId('demo-back').click()
    await expect(page.getByTestId('menu-screen')).toBeVisible()
  })
})
