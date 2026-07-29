// Feature 18 — Suggestion de lieu par la Meute (migration 0039).
//
// Types partagés + moteur du mode DÉMO (AsyncStorage). Le mode supabase
// (INSERT/SELECT sous RLS own, quota par trigger) vit dans
// data-source.supabase.ts ; l'aiguillage dans data-source.ts. Ce module est
// importé STATIQUEMENT par data-source (même doctrine que crew-demo : la
// branche démo doit marcher partout, y compris sous jest où `import()`
// runtime n'est pas disponible). AsyncStorage est chargé en require() lazy
// (pattern monitoring.ts) : son module jette à l'import quand le natif est
// absent (jest sans mock) — on ne le touche que si la branche démo s'exécute,
// sous try/catch.

export type PlaceSuggestionStatus = "pending" | "approved" | "rejected";

export interface PlaceSuggestionInput {
  /** Nom du lieu — seul champ requis (CHECK name non vide côté DB). */
  name: string;
  /** Libellé lisible de la commune (ex. « Cocody ») — convention onboarding. */
  commune: string | null;
  /** Repère descriptif « en face de la pharmacie X » — pas de code postal. */
  neighborhood: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  /** Mode supabase : paths Storage (bucket place-photos) ; démo : URIs locales. */
  photo_urls: string[];
}

export interface PlaceSuggestionRow extends PlaceSuggestionInput {
  id: string;
  status: PlaceSuggestionStatus;
  /** Motif de refus posé par le staff (status = rejected). */
  rejection_reason: string | null;
  created_at: string;
}

/** Miroir client du rate-limit DB (trigger 0039) : max 5 suggestions pending. */
export const MAX_PENDING_SUGGESTIONS = 5;

export type SubmitSuggestionResult = "ok" | "quota_exceeded" | "error";

// ─── Mode démo — stockage local, statut simulé ──────────────────────────────

export const STORAGE_KEY = "spawt:place-suggestions";

/** Chargement lazy d'AsyncStorage — voir le commentaire d'en-tête. Interop
 *  default/namespace : le module réel expose `.default`, le mock jest expose
 *  l'API au top-level. */
function getAsyncStorage(): typeof import("@react-native-async-storage/async-storage").default {
  const mod = require("@react-native-async-storage/async-storage") as {
    default?: typeof import("@react-native-async-storage/async-storage").default;
  };
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

async function loadDemoRows(): Promise<PlaceSuggestionRow[]> {
  try {
    const raw = await getAsyncStorage().getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PlaceSuggestionRow[]) : [];
  } catch {
    return [];
  }
}

/** Id local suffisant pour une clé React — pas besoin d'UUID en démo. */
function demoId(): string {
  return `demo-sugg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mode démo — enregistre la suggestion en local, statut simulé `pending`
 * (aucun staff pour la traiter sans backend). Applique le même quota que le
 * trigger DB : 5 pending max, au-delà → "quota_exceeded".
 */
export async function submitDemoPlaceSuggestion(
  input: PlaceSuggestionInput,
): Promise<SubmitSuggestionResult> {
  try {
    const rows = await loadDemoRows();
    const pending = rows.filter((r) => r.status === "pending").length;
    if (pending >= MAX_PENDING_SUGGESTIONS) return "quota_exceeded";
    const row: PlaceSuggestionRow = {
      ...input,
      id: demoId(),
      status: "pending",
      rejection_reason: null,
      created_at: new Date().toISOString(),
    };
    await getAsyncStorage().setItem(STORAGE_KEY, JSON.stringify([row, ...rows]));
    return "ok";
  } catch (err) {
    if (__DEV__) console.warn("[place-suggestions] submit démo failed", err);
    return "error";
  }
}

/** Mode démo — suggestions locales, plus récentes d'abord. */
export async function listDemoPlaceSuggestions(): Promise<PlaceSuggestionRow[]> {
  const rows = await loadDemoRows();
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
