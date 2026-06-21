export class ObjectPool<T> {
  private readonly inactive: T[] = []
  private readonly active: T[] = []

  constructor(
    private readonly factory: (index: number) => T,
    private readonly reset: (obj: T) => void,
    initialSize: number,
  ) {
    for (let index = 0; index < initialSize; index += 1) {
      this.inactive.push(this.factory(index))
    }
  }

  get(): T | null {
    const obj = this.inactive.pop()
    if (obj === undefined) {
      return null
    }
    this.active.push(obj)
    return obj
  }

  release(obj: T): void {
    const index = this.active.indexOf(obj)
    if (index < 0) {
      return
    }
    this.active.splice(index, 1)
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
