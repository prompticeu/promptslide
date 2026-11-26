/** Stop waiting immediately, even when a third-party loader ignores cancellation. */
export function abortable<T>(work: PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return Promise.resolve(work)
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException("Export cancelled", "AbortError"))
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    void Promise.resolve(work).then(
      value => {
        signal.removeEventListener("abort", abort)
        resolve(value)
      },
      error => {
        signal.removeEventListener("abort", abort)
        reject(error)
      }
    )
  })
}
