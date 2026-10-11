const g = globalThis as typeof globalThis & { __thirakPresence?: Map<string, number> };
export const presence = (g.__thirakPresence ??= new Map());

export function isOnline(userId: string) {
  return (presence.get(userId) ?? 0) > 0;
}
