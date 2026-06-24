const defaultStartTimeoutMs = 45000
const retryIntervalMs = 350

export async function clickStartButton(page, timeoutMs = defaultStartTimeoutMs) {
  await page.waitForFunction(() => {
    const screen = document.querySelector("#start-screen")
    const button = document.querySelector(".tap-to-start")
    if (!(screen instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
      return false
    }
    const screenVisible = getComputedStyle(screen).display !== "none"
    const rect = button.getBoundingClientRect()
    return screenVisible && !button.disabled && rect.width > 0 && rect.height > 0
  }, null, { timeout: timeoutMs })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const started = await page.evaluate(() => window.__squadRushQaStarted === true)
    if (started) {
      return
    }
    const box = await page.locator(".tap-to-start").boundingBox()
    if (box !== null) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.evaluate(() => {
      const button = document.querySelector(".tap-to-start")
      if (button instanceof HTMLButtonElement) {
        button.click()
      }
      if (typeof window.__squadRushQaStart === "function") {
        window.__squadRushQaStart()
      }
    })
    await page.waitForTimeout(retryIntervalMs)
  }
  throw new Error("Start button did not transition into gameplay.")
}
