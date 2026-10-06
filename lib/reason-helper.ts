export function normalizeReason(reason: string): string {
  return reason.trim().toLowerCase().replace(/\s+/g, " ");
}
