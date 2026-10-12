const ACCOUNT_ROUTES = new Set([
  "(tabs)", "search", "saved", "settings", "rapide", "explore", "crew",
  "progression", "suggest-place", "wrapped", "reservations", "spawts",
  "coups-de-coeur", "review",
]);

type Decision =
  | { ready: true }
  | { ready: false; redirect?: "/" | "/(tabs)" };

/** Ne décider de l'accès qu'une fois la restauration du compte terminée. */
export function getRouteGuardDecision({
  firstSegment, hydrating, hasSpawter,
}: { firstSegment: string | undefined; hydrating: boolean; hasSpawter: boolean }): Decision {
  if (hydrating) return { ready: false };
  if (hasSpawter && (!firstSegment || firstSegment === "(onboarding)")) {
    return { ready: false, redirect: "/(tabs)" };
  }
  if (!hasSpawter && firstSegment && ACCOUNT_ROUTES.has(firstSegment)) {
    return { ready: false, redirect: "/" };
  }
  return { ready: true };
}
