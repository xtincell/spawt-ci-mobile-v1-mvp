// Console admin 07/2026 — logique pure de la page Comptes B2B (testable sans
// Refine). Table b2b_accounts (0043) + policies staff admin (0049).
// Le lien se fait par téléphone : le patron du lieu se connecte à l'app par
// OTP comme tout le monde → son compte spawter (spawters.id = auth.uid())
// sert d'auth_user_id au compte B2B.

export interface B2bAccountRow {
  id: string;
  auth_user_id: string;
  place_id: string;
  role: "pro" | "gold";
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  places?: { name: string; neighborhood: string | null } | null;
}

export const B2B_ROLES = ["pro", "gold"] as const;
export type B2bRole = (typeof B2B_ROLES)[number];

export const ROLE_LABELS: Record<B2bRole, string> = {
  pro: "Pro (stats mensuelles)",
  gold: "Gold (stats + funnel signaux)",
};

/**
 * Canonise un téléphone saisi vers le E.164 utilisé partout (+225XXXXXXXXXX).
 * Tolère espaces/points/tirets/parenthèses, préfixe 00, et le format local CI
 * à 10 chiffres (auquel on préfixe +225). Retourne null si inexploitable.
 */
export function normalizePhoneE164(input: string): string | null {
  const cleaned = input.replace(/[\s.()-]/g, "");
  if (cleaned.length === 0) return null;
  let candidate = cleaned;
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;
  if (!candidate.startsWith("+")) {
    if (/^225\d{10}$/.test(candidate)) {
      candidate = `+${candidate}`;
    } else if (/^\d{10}$/.test(candidate)) {
      // Numéro local CI (10 chiffres depuis le plan 2021) → +225.
      candidate = `+225${candidate}`;
    } else {
      return null;
    }
  }
  return /^\+\d{8,15}$/.test(candidate) ? candidate : null;
}

export interface B2bFormValues {
  phone: string;
  place_id: string;
  role: B2bRole;
  contact_name: string;
}

export const EMPTY_B2B_FORM: B2bFormValues = {
  phone: "",
  place_id: "",
  role: "pro",
  contact_name: "",
};

export interface B2bInsertRow {
  auth_user_id: string;
  place_id: string;
  role: B2bRole;
  contact_name: string | null;
  contact_phone: string | null;
}

export type B2bValidation =
  | { ok: true; row: B2bInsertRow }
  | { ok: false; errors: string[] };

/** Validation du lien : spawter résolu (lookup phone) + lieu + rôle. */
export function validateB2bLink(
  v: B2bFormValues,
  resolvedAuthUserId: string | null,
): B2bValidation {
  const errors: string[] = [];
  const phone = normalizePhoneE164(v.phone);
  if (!phone) errors.push("Téléphone invalide (attendu +225XXXXXXXXXX).");
  if (!resolvedAuthUserId) {
    errors.push("Aucun compte trouvé pour ce téléphone — le contact doit d'abord se connecter à l'app (OTP).");
  }
  if (!v.place_id) errors.push("Choisis le lieu à lier.");
  if (!(B2B_ROLES as readonly string[]).includes(v.role)) errors.push("Rôle invalide.");
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      auth_user_id: resolvedAuthUserId as string,
      place_id: v.place_id,
      role: v.role,
      contact_name: v.contact_name.trim() || null,
      contact_phone: phone,
    },
  };
}

/** Message d'erreur DB → UI (23505 = compte déjà lié, auth_user_id UNIQUE). */
export function b2bInsertErrorMessage(error: { code?: string | null; message?: string | null } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    return "Ce compte est déjà lié à un lieu (un compte B2B par personne). Désactive l'ancien lien d'abord.";
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "")) {
    return "Réservé aux admins";
  }
  return error.message ?? "Erreur inconnue";
}
