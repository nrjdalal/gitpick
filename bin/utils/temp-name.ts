// A short, collision-resistant name for a temp dir/file, e.g. `tempName("gitpick-")`.
export const tempName = (prefix: string) =>
  `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 6)}`
