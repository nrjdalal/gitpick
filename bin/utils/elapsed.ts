// Seconds elapsed since a `performance.now()` timestamp, rounded to 2 decimals.
export const elapsedSeconds = (start: number) =>
  Number(((performance.now() - start) / 1000).toFixed(2))
