// La session SDK et les RLS existantes font autorité. Aucun upsert ici :
// une panne ou un compte partiel ne doivent jamais devenir une inscription.
import { supabase } from "./supabase";
import type { OnboardingDraft, Spawter } from "../types/spawter";
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

export async function readAuthenticatedAccount(
  expectedOwner?: string | null,
  signal?: AbortSignal,
  onboarding?: Pick<OnboardingDraft, "phone_e164" | "consent">,
): Promise<AccountRecovery> {
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
    // Only a current, explicit grant from the phone verified in this OTP flow
    // can fill a missing timestamp. Other devices may have filled it meanwhile.
    if (expectedOwner === owner && onboarding?.phone_e164 && onboarding.phone_e164 === profile.data.phone_e164) {
      let wroteConsent = false;
      for (const field of ["cgv_accepted_at", "geoloc_consent_at"] as const) {
        const accepted = onboarding.consent[field];
        if (profile.data[field] || !accepted || !Number.isFinite(Date.parse(accepted))) continue;
        const result = await supabase.from("spawters").update({ [field]: accepted })
          .eq("id", owner).is(field, null).abortSignal(abort.signal);
        if (result.error || abort.signal.aborted) throw new Error("ACCOUNT_READ_FAILED");
        wroteConsent = true;
      }
      if (wroteConsent) {
        const confirmed = await supabase.from("spawters").select("cgv_accepted_at,geoloc_consent_at")
          .eq("id", owner).abortSignal(abort.signal).maybeSingle<OnboardingDraft["consent"]>();
        if (confirmed.error || !confirmed.data || abort.signal.aborted) throw new Error("ACCOUNT_READ_FAILED");
        for (const field of ["cgv_accepted_at", "geoloc_consent_at"] as const) {
          if (onboarding.consent[field] && !confirmed.data[field]) throw new Error("ACCOUNT_READ_FAILED");
        }
        await requireAccountSession(owner);
        return { kind: "existing", owner, spawter: {
          ...profile.data, cgv_accepted_at: confirmed.data.cgv_accepted_at, geoloc_consent_at: confirmed.data.geoloc_consent_at,
        }, palais: taste.data };
      }
    }
    return { kind: "existing", owner, spawter: profile.data, palais: taste.data };
  } catch (error) {
    if (error instanceof Error && /^ACCOUNT_/.test(error.message)) throw error;
    throw new Error("ACCOUNT_READ_FAILED");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
