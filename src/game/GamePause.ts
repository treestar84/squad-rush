import { AudioSystem } from "./systems/AudioSystem"
import { PauseControl } from "../ui/PauseControl"

export class GamePause {
  private readonly control: PauseControl
  paused = false

  constructor(root: HTMLElement, private readonly audio: AudioSystem) {
    this.control = new PauseControl(root)
    this.control.onToggle = () => this.setPaused(!this.paused)
  }

  hide(): void {
    this.control.hide()
  }

  show(): void {
    this.control.show()
  }

  private setPaused(paused: boolean): void {
    this.paused = paused
    this.control.setPaused(paused)
    this.audio.playUiReveal()
    if (paused) {
      this.audio.stopRunAmbience()
      return
    }
    this.audio.unlock()
    this.audio.startRunAmbience()
  }
}
