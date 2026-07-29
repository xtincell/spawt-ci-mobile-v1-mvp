// Câblage MVP — Crash reporting Sentry (NFR-PERF-02), gated par env var.
//
// Politique : ZÉRO effet sans `EXPO_PUBLIC_SENTRY_DSN` (pas de DSN = no-op
// silencieux, aucun réseau). Le DSN arrive par secret EAS (HUMAN_TODO.md) —
// jamais en dur. Pas de plugin de sourcemaps V1 (le plugin exige un
// SENTRY_AUTH_TOKEN au build ; les stacks JS non-symbolisées suffisent pour
// l'alpha, upgrade documentée dans le skill spawt-release).
//
// PII : sendDefaultPii false. Les events ne portent ni téléphone ni position —
// conforme Loi 2013-450 (le consentement ARTCI couvre la géoloc produit, pas
// la télémétrie de crash enrichie).

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

let initialized = false;

/** Init au boot du Root layout. No-op sans DSN ou si déjà initialisé. */
export function initMonitoring(): void {
  if (initialized || !DSN) return;
  initialized = true;
  try {
    // Import statique — le module est toujours bundlé mais inerte sans init.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/react-native") as typeof import("@sentry/react-native");
    Sentry.init({
      dsn: DSN,
      sendDefaultPii: false,
      // Alpha : traces légères ; monter via env quand le volume le justifie.
      tracesSampleRate: 0.2,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? "alpha",
    });
  } catch (err) {
    if (__DEV__) console.warn("[monitoring] Sentry init failed", err);
    initialized = false;
  }
}

/** Capture manuelle best-effort (utilisable partout, no-op sans DSN). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/react-native") as typeof import("@sentry/react-native");
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // no-op
  }
}
