import path from 'node:path'
import fs from 'node:fs'
import type { Page, TestInfo } from '@playwright/test'

/** Guarda un screenshot en e2e/screenshots/<name>.png */
export async function snap(page: Page, testInfo: TestInfo, name: string) {
  const dir = path.resolve(testInfo.project.testDir, '..', 'screenshots')
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
}
