export function isBefore(timestamp: number | undefined): boolean {
  if (!timestamp) return false;
  return Date.now() < timestamp;
}

// Plain-module wrapper so event handlers in compiled components can take a
// timestamp without tripping the React Compiler purity lint.
export function nowMs(): number {
  return Date.now();
}
