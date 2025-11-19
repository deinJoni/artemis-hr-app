/**
 * Bun 1.0.x does not yet ship AbortSignal.any, but LangChain relies on it when
 * coordinating streaming responses. This lightweight polyfill matches the
 * Node.js semantics closely enough for our usage.
 */
if (typeof globalThis.AbortSignal !== 'undefined' && typeof globalThis.AbortSignal.any !== 'function') {
  globalThis.AbortSignal.any = function anyPolyfill(signals: Array<AbortSignal | null | undefined>) {
    const validSignals = (signals ?? []).filter(
      (maybeSignal): maybeSignal is AbortSignal =>
        !!maybeSignal && typeof maybeSignal === 'object' && 'aborted' in maybeSignal && typeof maybeSignal.aborted === 'boolean'
    )

    if (validSignals.length === 0) {
      throw new TypeError('AbortSignal.any requires at least one AbortSignal')
    }

    const controller = new AbortController()
    const abort = (signal: AbortSignal) => () => {
      controller.abort(signal.reason)
      cleanup()
    }

    const listeners: Array<() => void> = []

    const cleanup = () => {
      listeners.forEach((remove) => remove())
      listeners.length = 0
    }

    for (const signal of validSignals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return controller.signal
      }

      const listener = abort(signal)
      signal.addEventListener('abort', listener, { once: true })
      listeners.push(() => signal.removeEventListener('abort', listener))
    }

    return controller.signal
  }

  console.warn('[backend] Polyfilled AbortSignal.any; consider removing when Bun adds native support.')
}
