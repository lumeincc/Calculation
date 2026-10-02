/** First-visit tour flag (per browser). */
const KEY = 'sr-tour'

export function tourDone(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return true
  }
}

export function resetTour() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function finishTour() {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    /* ignore */
  }
}
