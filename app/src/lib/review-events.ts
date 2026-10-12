const listeners = new Set<(placeId: string) => void>();

export function subscribeReviewChanges(listener: (placeId: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyReviewChanged(placeId: string): void {
  for (const listener of listeners) {
    try { listener(placeId); } catch (error) { if (__DEV__) console.warn("[reviews] refresh failed", error); }
  }
}
