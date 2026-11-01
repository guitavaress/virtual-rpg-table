import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end flow on the synthetic source (no permission prompt, no real
 * faces). The real getDisplayMedia picker still needs the manual smoke test.
 */

async function startSynthetic(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Usar fonte sintética de teste' }).click()
}

async function goToTable(page: Page) {
  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  await page.getByRole('button', { name: 'Distribuir automaticamente' }).click()
  await page.getByRole('button', { name: 'Ir para a mesa' }).click()
  await expect(page.getByRole('heading', { name: 'Mesa' })).toBeVisible()
}

/** Average color of each portrait canvas (read back by the test only). */
function portraitColors(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('[data-testid="portrait-canvas"]')].map(
      (c) => {
        const ctx = c.getContext('2d')
        if (!ctx || c.width === 0) return null
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        const sum = [0, 0, 0]
        for (let i = 0; i < d.length; i += 4) {
          sum[0] = (sum[0] ?? 0) + (d[i] ?? 0)
          sum[1] = (sum[1] ?? 0) + (d[i + 1] ?? 0)
          sum[2] = (sum[2] ?? 0) + (d[i + 2] ?? 0)
        }
        const n = d.length / 4
        return { w: c.width, h: c.height, rgb: sum.map((s) => s / n), alpha: d[3] ?? 0 }
      },
    ),
  )
}

test('five live 3:4 portraits plus the remote seat', async ({ page }) => {
  await startSynthetic(page)
  await goToTable(page)

  await expect(page.getByRole('article')).toHaveCount(6)
  await expect(page.getByRole('article', { name: 'Você' })).toContainText('Remoto')

  await expect
    .poll(async () => (await portraitColors(page)).filter((p) => p && p.alpha > 0).length)
    .toBe(5)
  const colors = await portraitColors(page)
  for (const p of colors) {
    expect(p).not.toBeNull()
    expect((p?.w ?? 0) / (p?.h ?? 1)).toBeCloseTo(0.75, 1)
  }
  // Each portrait shows a different player (different shirt/skin colors).
  const keys = new Set(colors.map((p) => p?.rgb.map((v) => Math.round(v / 8)).join(',')))
  expect(keys.size).toBe(5)

  // The visible card keeps 3:4 regardless of layout.
  const box = await page.locator('.portrait').first().boundingBox()
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(0.75, 2)
})

test('names and crops survive a reload; next capture opens on the table', async ({ page }) => {
  await startSynthetic(page)
  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  await page.getByLabel('Nome 2').fill('Bruno')
  await page.getByLabel('Personagem 2').fill('Anão clérigo')
  await page.getByRole('button', { name: 'Ir para a mesa' }).click()
  await expect(page.getByRole('article', { name: 'Bruno, Anão clérigo' })).toBeVisible()

  await page.reload()
  await expect(page.getByText(/está salva neste navegador/)).toBeVisible()
  await page.getByRole('button', { name: 'Usar fonte sintética de teste' }).click()
  await expect(page.getByRole('heading', { name: 'Mesa' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Bruno, Anão clérigo' })).toBeVisible()
})

test('moving the ROI carries the five crops with it', async ({ page }) => {
  await startSynthetic(page)
  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  const before = await page.getByTestId('crop-p1').boundingBox()

  await page.getByRole('button', { name: '1. Câmera coletiva' }).click()
  const roi = page.getByTestId('roi-box')
  await roi.focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  const after = await page.getByTestId('crop-p1').boundingBox()

  expect(after?.x ?? 0).toBeGreaterThan((before?.x ?? 0) + 20)
  expect(after?.width).toBeCloseTo(before?.width ?? -1, 0)
})

test('remote seat switches between avatar and capture crop', async ({ page }) => {
  await startSynthetic(page)
  await goToTable(page)
  const remote = page.getByRole('article', { name: 'Você' })
  await expect(remote.locator('canvas')).toHaveCount(0)
  await expect(remote).toContainText('V')

  await page.getByRole('button', { name: 'Calibrar' }).click()
  await page.getByLabel('Recorte da captura').check()
  await expect(page.getByTestId('crop-remote')).toBeVisible()
  await page.getByRole('button', { name: 'Ir para a mesa' }).click()
  await expect(remote.locator('canvas')).toHaveCount(1)
})
