// PRD §11 — Spawter Gold (premium). Sprint 2 : l'entitlement est lu depuis la
// vue `active_entitlements` (migration 0032, RLS own rows) via le store.
//
// Modèle Spotify/Netflix (conformité Apple 3.1.3) : l'app ne vend RIEN — pas
// de prix, pas de bouton d'achat in-app. L'achat et la gestion d'abonnement
// vivent sur le portail web (spawt.online), l'app se contente de LIRE le
// droit et de pointer vers le portail.
//
// Architecture :
//   - le store (spawter-store) hydrate/persiste/revalide l'entitlement
//     (AsyncStorage + fetchGoldEntitlement) et pousse l'état ici via
//     setGoldEntitlementState ;
//   - `isGoldSpawter(spawter)` reste SYNCHRONE (contrat des call-sites
//     existants : paywall-geo home/search, profil, SpawterCard) et lit ce
//     cache module — avec ré-évaluation locale de la fenêtre d'échéance pour
//     qu'un cache persisté périmé (échéance passée offline) ne donne pas un
//     Gold fantôme.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Spawter } from "../types/spawter";
import type { GoldEntitlement } from "./data-source";

/** Clé AsyncStorage du cache d'entitlement (purgée au reset — cross-user). */
export const GOLD_STORAGE_KEY = "spawt:gold_entitlement";

// ─── Portail web (achat + gestion — jamais in-app) ──────────────────────────

const PORTAL_BASE = process.env.EXPO_PUBLIC_PORTAL_URL ?? "https://spawt.online";

/** Page Gold du portail (upsell → « Passe Gold sur spawt.online »). */
export function portalGoldUrl(): string {
  return `${PORTAL_BASE}/gold`;
}

/** Page compte du portail (« Gérer mon abonnement »). */
export function portalAccountUrl(): string {
  return `${PORTAL_BASE}/compte`;
}

// ─── Cache module synchrone (alimenté par le store) ─────────────────────────

let currentGold: GoldEntitlement | null = null;

/** Pousse l'état d'entitlement courant (store : hydrate / refresh / reset). */
export function setGoldEntitlementState(entitlement: GoldEntitlement | null): void {
  currentGold = entitlement;
}

/** Lecture brute du cache (debug / tests). */
export function getGoldEntitlementState(): GoldEntitlement | null {
  return currentGold;
}

/**
 * Ré-évaluation LOCALE du droit — miroir du prédicat `is_active` de la vue
 * active_entitlements (0032) : status actif/grâce ET (pas d'échéance, ou
 * échéance future, ou fenêtre de grâce encore ouverte). Protège contre un
 * cache persisté dont l'échéance est passée depuis la dernière revalidation.
 */
export function isEntitlementCurrentlyActive(
  entitlement: GoldEntitlement | null,
  nowMs: number = Date.now(),
): boolean {
  if (!entitlement || !entitlement.active) return false;
  if (entitlement.status !== null && !["active", "grace"].includes(entitlement.status)) {
    return false;
  }
  const expires = entitlement.expires_at ? Date.parse(entitlement.expires_at) : null;
  if (expires === null || Number.isNaN(expires) || expires > nowMs) return true;
  const grace = entitlement.grace_until ? Date.parse(entitlement.grace_until) : null;
  return grace !== null && !Number.isNaN(grace) && grace > nowMs;
}

/**
 * Un spawter est-il Gold ? Synchrone (contrat historique) : lit l'état
 * hydraté par le store. Le paramètre `spawter` est conservé pour les
 * call-sites existants — le droit est par-compte (RLS own), pas par-objet.
 * Mode démo : le store hydrate un entitlement inactif → false.
 */
export function isGoldSpawter(_spawter: Spawter): boolean {
  return isEntitlementCurrentlyActive(currentGold);
}

// ─── Persistance locale (cache offline-first, revalidé par le store) ────────

export async function loadGoldLocal(): Promise<GoldEntitlement | null> {
  try {
    const raw = await AsyncStorage.getItem(GOLD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoldEntitlement;
    return typeof parsed === "object" && parsed !== null && typeof parsed.active === "boolean"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function saveGoldLocal(entitlement: GoldEntitlement): Promise<boolean> {
  try {
    await AsyncStorage.setItem(GOLD_STORAGE_KEY, JSON.stringify(entitlement));
    return true;
  } catch {
    return false;
  }
}
