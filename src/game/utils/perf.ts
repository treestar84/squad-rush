export function measureFPS(durationMs: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const start = performance.now()

    function tick(): void {
      frames += 1
      if (performance.now() - start < durationMs) {
        requestAnimationFrame(tick)
        return
      }
      resolve(frames / (durationMs / 1000))
    }

    requestAnimationFrame(tick)
  })
}
