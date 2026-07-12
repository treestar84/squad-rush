export class ObjectPool<T> {
  private readonly inactive: T[] = []
  private readonly active: T[] = []
  private readonly activeIndices = new Map<T, number>()
  private createdCount = 0

  constructor(
    private readonly factory: (index: number) => T,
    private readonly reset: (obj: T) => void,
    initialSize: number,
    private readonly maxSize = initialSize,
  ) {
    const prewarmSize = Math.min(initialSize, maxSize)
    for (let index = 0; index < prewarmSize; index += 1) {
      this.inactive.push(this.factory(index))
    }
    this.createdCount = prewarmSize
  }

  get(): T | null {
    let obj = this.inactive.pop()
    if (obj === undefined && this.createdCount < this.maxSize) {
      obj = this.factory(this.createdCount)
      this.createdCount += 1
    }
    if (obj === undefined) {
      return null
    }
    this.activeIndices.set(obj, this.active.length)
    this.active.push(obj)
    return obj
  }

  release(obj: T): void {
    const index = this.activeIndices.get(obj)
    if (index === undefined) {
      return
    }
    const lastIndex = this.active.length - 1
    const last = this.active[lastIndex]
    if (index !== lastIndex && last !== undefined) {
      this.active[index] = last
      this.activeIndices.set(last, index)
    }
    this.active.pop()
    this.activeIndices.delete(obj)
    this.reset(obj)
    this.inactive.push(obj)
  }

  getActive(): readonly T[] {
    return this.active
  }

  activeCount(): number {
    return this.active.length
  }
}
