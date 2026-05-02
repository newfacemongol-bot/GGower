export const FB_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FB_SAFE_CUTOFF_MS = 23.5 * 60 * 60 * 1000;

export function msRemaining(lastMessageAt: Date | string | null | undefined, from: Date = new Date()): number {
  if (!lastMessageAt) return 0;
  const last = new Date(lastMessageAt).getTime();
  return Math.max(0, FB_WINDOW_MS - (from.getTime() - last));
}

export function isWindowClosed(lastMessageAt: Date | string | null | undefined, from: Date = new Date()): boolean {
  return msRemaining(lastMessageAt, from) <= 0;
}

export function isWithinSafeSendWindow(lastMessageAt: Date | string | null | undefined, from: Date = new Date()): boolean {
  if (!lastMessageAt) return false;
  const last = new Date(lastMessageAt).getTime();
  return from.getTime() - last <= FB_SAFE_CUTOFF_MS;
}
