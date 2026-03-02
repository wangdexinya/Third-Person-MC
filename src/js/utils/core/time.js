import emitter from '../event/event-bus.js'

export default class Time {
  constructor() {
    // Setup
    this.start = Date.now()
    this.current = this.start
    this.elapsed = 0
    this.delta = 16

    // RAF ID for cleanup
    this.rafId = null

    this.rafId = window.requestAnimationFrame(() => {
      this.tick()
    })
  }

  tick() {
    const currentTime = Date.now()
    // Clamp delta to 100ms max to prevent physics tunneling when tab is backgrounded
    this.delta = Math.min(currentTime - this.current, 100)
    this.current = currentTime
    this.elapsed = this.current - this.start

    emitter.emit('core:tick', {
      delta: this.delta,
      elapsed: this.elapsed,
    })

    this.rafId = window.requestAnimationFrame(() => {
      this.tick()
    })
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}
