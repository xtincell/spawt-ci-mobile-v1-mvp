// Réservation 1-tap (migration 0042) — V1 : SPAWT n'orchestre PAS la table,
// il ouvre le canal (WhatsApp pré-rempli) et TRACE la demande (best-effort).
// La confirmation se joue hors app.
//
// Types partagés + helpers purs + moteur du mode DÉMO (AsyncStorage, lazy
// require — doctrine place-suggestions). Le mode supabase (INSERT/SELECT
// sous RLS own) vit dans data-source.supabase.ts ; l'aiguillage dans
// data-source.ts.

export type ReservationChannel = "whatsapp" | "phone";
export type ReservationStatus = "sent" | "confirmed" | "cancelled";

export interface ReservationRequestInput {
  place_id: string;
  /** Nom du lieu — dénormalisé pour la liste « mes résas » (démo surtout). */
  place_name: string;
  /** 1-20 (CHECK DB party_size BETWEEN 1 AND 20). */
  party_size: number;
  /** Créneau souhaité (ISO) — null = « je précise sur WhatsApp ». */
  slot_at: string | null;
  channel: ReservationChannel;
}

export interface ReservationRow extends ReservationRequestInput {
  id: string;
  status: ReservationStatus;
  created_at: string;
}

/** Bornes du CHECK DB — clampe côté client pour ne jamais violer 0042. */
export const PARTY_SIZE_MIN = 1;
export const PARTY_SIZE_MAX = 20;

export function clampPartySize(n: number): number {
  if (!Number.isFinite(n)) return PARTY_SIZE_MIN;
  return Math.max(PARTY_SIZE_MIN, Math.min(PARTY_SIZE_MAX, Math.round(n)));
}

/**
 * URL WhatsApp pré-remplie (`https://wa.me/<digits>?text=…`). Retourne null
 * si le numéro ne contient aucun chiffre (wa.me sans destinataire ouvre
 * WhatsApp dans le vide — même garde que la fiche lieu).
 */
export function buildWaMeUrl(whatsapp: string, text: string): string | null {
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// ─── Mode démo — trace locale, statut « sent » ──────────────────────────────

const STORAGE_KEY = "spawt:reservations";

/** Chargement lazy d'AsyncStorage (pattern place-suggestions) : le module
 *  jette à l'import quand le natif est absent (jest sans mock). */
function getAsyncStorage(): typeof import("@react-native-async-storage/async-storage").default {
  const mod = require("@react-native-async-storage/async-storage") as {
    default?: typeof import("@react-native-async-storage/async-storage").default;
  };
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

async function loadDemoRows(): Promise<ReservationRow[]> {
  try {
    const raw = await getAsyncStorage().getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReservationRow[]) : [];
  } catch {
    return [];
  }
}

function demoId(): string {
  return `demo-resa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mode démo — trace la demande en local. Best-effort : échec de stockage →
 * null (le WhatsApp s'ouvre quand même, la trace est un bonus, jamais un
 * blocage — même contrat que le mode supabase).
 */
export async function createDemoReservationRequest(
  input: ReservationRequestInput,
): Promise<ReservationRow | null> {
  try {
    const rows = await loadDemoRows();
    const row: ReservationRow = {
      ...input,
      party_size: clampPartySize(input.party_size),
      id: demoId(),
      status: "sent",
      created_at: new Date().toISOString(),
    };
    await getAsyncStorage().setItem(STORAGE_KEY, JSON.stringify([row, ...rows]));
    return row;
  } catch (err) {
    if (__DEV__) console.warn("[reservations] create démo failed", err);
    return null;
  }
}

/** Mode démo — demandes locales, plus récentes d'abord. */
export async function listDemoReservations(): Promise<ReservationRow[]> {
  const rows = await loadDemoRows();
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
