const defaultStartTimeoutMs = 45000

export async function clickStartButton(page, timeoutMs = defaultStartTimeoutMs) {
  await page.waitForFunction(() => {
    return typeof window.__squadRushQaStart === "function"
  }, null, { timeout: timeoutMs })

  await page.evaluate(() => {
    window.__squadRushQaStart?.()
  })

  await page.waitForFunction(() => window.__squadRushQaStarted === true, null, { timeout: timeoutMs })
}
