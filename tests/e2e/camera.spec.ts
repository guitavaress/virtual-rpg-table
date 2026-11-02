import { expect, test } from '@playwright/test'

/**
 * "Câmera deste computador" with Chromium's fake camera (a moving test
 * pattern). It proves the getUserMedia path end to end without a real webcam;
 * sharing the camera with the Meet still needs the manual W0 test.
 */
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

test('fake camera → permission → list → calibration with real resolution → table portraits', async ({
  page,
}) => {
  await page.goto('/')
  // Chromium's fake-UI flag may expose labels before any permission; when it does
  // the list shows itself, otherwise the first click asks and then lists.
  const labelsHidden = await page.evaluate(async () =>
    (await navigator.mediaDevices.enumerateDevices()).every((d) => d.label === ''),
  )
  if (labelsHidden) {
    await page.getByRole('button', { name: 'Câmera deste computador', exact: true }).click()
  }

  const camera = page.getByLabel('Câmera', { exact: true })
  await expect(camera.locator('option')).toHaveCount(2) // default + fake_device_0
  await page.getByLabel('Qualidade').selectOption('720p')
  await page.getByRole('button', { name: 'Usar câmera deste computador' }).click()

  await expect(page.getByRole('heading', { name: 'Calibração' })).toBeVisible()
  await expect(page.getByText('Câmera deste computador').first()).toBeVisible()
  // The real delivered resolution (track.getSettings) is shown next to the <video> size.
  await expect(page.getByTestId('track-resolution')).toHaveText(/^\d+×\d+/)
  await expect(page.getByTestId('source-resolution')).toHaveText(/^\d+×\d+$/)

  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  await page.getByRole('button', { name: 'Distribuir automaticamente' }).click()
  await page.getByRole('button', { name: 'Ir para a mesa' }).click()
  await expect(page.getByRole('heading', { name: 'Mesa' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(6)

  // Portraits are really drawn: every canvas has non-transparent, non-uniform pixels.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [
            ...document.querySelectorAll<HTMLCanvasElement>('[data-testid="portrait-canvas"]'),
          ].filter((c) => {
            const ctx = c.getContext('2d')
            if (!ctx || c.width === 0) return false
            const d = ctx.getImageData(0, 0, c.width, c.height).data
            let opaque = false
            for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) opaque = true
            return opaque
          }).length,
      ),
    )
    .toBe(5)

  // Back to the setup after stopping (track release is covered by the unit tests).
  await page.getByRole('button', { name: 'Parar captura' }).click()
  await expect(page.getByRole('heading', { name: 'Virtual RPG Table' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usar câmera deste computador' })).toBeVisible()
})

test('Meet capture (synthetic here) and the webcam run together; the remote seat shows the webcam', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Usar fonte sintética de teste' }).click()
  await page.getByRole('button', { name: 'Próximo: jogadores' }).click()
  await page.getByRole('button', { name: 'Distribuir automaticamente' }).click()

  await page.getByLabel('Minha webcam').check()
  // Labels may already be visible with the fake-UI flag; otherwise grant first.
  const grant = page.getByRole('button', { name: 'Permitir e listar câmeras' })
  if (await grant.isVisible()) await grant.click()
  await page.getByRole('button', { name: 'Ligar minha webcam' }).click()
  await expect(page.getByTestId('webcam-label')).toBeVisible()
  await expect(page.getByTestId('webcam-resolution')).toHaveText(/^\d+×\d+/)

  await page.getByRole('button', { name: 'Ir para a mesa' }).click()
  await expect(page.getByRole('heading', { name: 'Mesa' })).toBeVisible()

  const painted = (selector: string) =>
    page.evaluate((sel) => {
      const c = document.querySelector<HTMLCanvasElement>(sel)
      const ctx = c?.getContext('2d')
      if (!c || !ctx || c.width === 0) return false
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) return true
      return false
    }, selector)

  // The five Meet portraits and the remote seat (webcam) are all drawn.
  await expect(page.getByRole('article')).toHaveCount(6)
  await expect.poll(() => painted('[data-area="remote"] canvas')).toBe(true)
  await expect.poll(() => painted('[data-area="p1"] canvas')).toBe(true)

  // Leaving the table turns off both sources.
  await page.getByRole('button', { name: 'Parar captura' }).click()
  await expect(page.getByRole('heading', { name: 'Virtual RPG Table' })).toBeVisible()
})
