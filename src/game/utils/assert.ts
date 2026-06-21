export class MissingElementError extends Error {
  constructor(readonly selector: string) {
    super(`Missing required DOM element: ${selector}`)
    this.name = "MissingElementError"
  }
}

export function requireElement<T extends HTMLElement>(
  id: string,
  expected: { new (...args: never[]): T },
): T {
  const element = document.getElementById(id)
  if (element instanceof expected) {
    return element
  }
  throw new MissingElementError(`#${id}`)
}
