// La session SDK et les RLS existantes font autorité. Aucun upsert ici :
// une panne ou un compte partiel ne doivent jamais devenir une inscription.
import { supabase } from "./supabase";
import type { Spawter } from "../types/spawter";
import { PALAIS_AXES, type UserPalais } from "../types/palais";
import { STADES } from "../types/stade";

export type AccountRecovery =
  | { kind: "new"; owner: string }
  | { kind: "incomplete"; owner: string; spawter: Spawter | null; palais: UserPalais | null }
  | { kind: "existing"; owner: string; spawter: Spawter; palais: UserPalais };

export async function requireAccountSession(expectedOwner?: string | null): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const owner = data.session?.user.id;
  if (error || !owner) throw new Error("ACCOUNT_NO_SESSION");
  if (expectedOwner && owner !== expectedOwner) throw new Error("ACCOUNT_SESSION_CHANGED");
  return owner;
}

/** Un profil créé avant son tout premier Palais peut reprendre les étapes
 * existantes. Une progression déjà présente exige une réparation, pas un zéro. */
export function canResumeMissingPalais(account: AccountRecovery): account is Extract<AccountRecovery, { kind: "incomplete" }> & { spawter: Spawter; palais: null } {
  return account.kind === "incomplete" && account.palais === null && !!account.spawter
    && account.spawter.id === account.owner && account.spawter.stade === "touriste"
    && account.spawter.total_spawts === 0 && account.spawter.unique_spots === 0
    && typeof account.spawter.display_name === "string";
}

/** Vérifier les identités et les valeurs que le moteur va consommer, sans
 * recalculer les axes, le stade, les consentements ou l'archétype historiques. */
export function validRecoveredAccount(spawter: Spawter, palais: UserPalais, owner: string): boolean {
  const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
  return spawter.id === owner && palais.spawter_id === owner
    && typeof spawter.display_name === "string" && spawter.display_name.length > 0
    && STADES.includes(spawter.stade) && STADES.includes(palais.stade)
    && count(spawter.total_spawts) && count(spawter.unique_spots) && count(palais.total_spawts)
    && PALAIS_AXES.every((axis) => {
      const value = palais[`axe_${axis}`];
      return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
    })
    && Number.isFinite(palais.confidence_score) && palais.confidence_score >= 0 && palais.confidence_score <= 1
    && (palais.dominant_axes === null || (Array.isArray(palais.dominant_axes)
      && palais.dominant_axes.length === 2 && palais.dominant_axes.every((axis) => PALAIS_AXES.includes(axis))));
}

export async function readAuthenticatedAccount(expectedOwner?: string | null, signal?: AbortSignal): Promise<AccountRecovery> {
  const owner = await requireAccountSession(expectedOwner);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (signal?.aborted) abort.abort();
  signal?.addEventListener("abort", cancel);
  const timeout = setTimeout(cancel, 15_000);
  try {
    const [profile, taste] = await Promise.all([
      supabase.from("spawters").select("*").eq("id", owner).abortSignal(abort.signal).maybeSingle<Spawter>(),
      supabase.from("user_palais").select("*").eq("spawter_id", owner).abortSignal(abort.signal).maybeSingle<UserPalais>(),
    ]);
    if (abort.signal.aborted || profile.error || taste.error) throw new Error("ACCOUNT_READ_FAILED");
    await requireAccountSession(owner);
    if (!profile.data && !taste.data) return { kind: "new", owner };
    if (!profile.data || !taste.data) return { kind: "incomplete", owner, spawter: profile.data, palais: taste.data };
    if (!validRecoveredAccount(profile.data, taste.data, owner)) throw new Error("ACCOUNT_INVALID");
    return { kind: "existing", owner, spawter: profile.data, palais: taste.data };
  } catch (error) {
    if (error instanceof Error && /^ACCOUNT_/.test(error.message)) throw error;
    throw new Error("ACCOUNT_READ_FAILED");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
