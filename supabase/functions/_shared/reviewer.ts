// Gate « review stores » (Apple/Google) — SOURCE UNIQUE partagée par otp-send
// (décision skip-SMS) et otp-verify (décision login). Le prédicat DOIT être
// identique des deux côtés.
//
// finding P2#11 : otp-send skippait le SMS sur simple présence du numéro dans
// REVIEWER_PHONE_E164, alors qu'otp-verify n'ouvrait le login que si
// REVIEWER_OTP_CODE était AUSSI posé et bien formé. En SMS réel avec un
// REVIEWER_OTP_CODE absent/malformé, le numéro whitelisté ne recevait donc plus
// aucun SMS (otp-send) ET n'avait pas de code reviewer (otp-verify) → inloggable.
// Ici, `isReviewerPhone` (skip-SMS) et `isReviewerLogin` (login) reposent sur le
// MÊME `isReviewerConfigured` : le chemin reviewer est tout-ou-rien.

/** Lecteur d'environnement minimal (Deno.env en prod, objet factice en test). */
export interface EnvReader {
  get(name: string): string | undefined;
}

/** Code OTP reviewer bien formé = 6-8 chiffres (même contrat que OTP_RE). */
const REVIEWER_OTP_RE = /^\d{6,8}$/;

function reviewerPhones(env: EnvReader): string[] {
  return (env.get("REVIEWER_PHONE_E164") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function reviewerCode(env: EnvReader): string {
  return env.get("REVIEWER_OTP_CODE") ?? "";
}

/**
 * Le chemin reviewer est-il CONFIGURÉ ? Exige les DEUX envs : au moins un numéro
 * whitelisté ET un code bien formé (6-8 chiffres). Prédicat commun au skip-SMS
 * et au login — sans lui, ni l'un ni l'autre ne s'active.
 */
export function isReviewerConfigured(env: EnvReader): boolean {
  return reviewerPhones(env).length > 0 && REVIEWER_OTP_RE.test(reviewerCode(env));
}

/**
 * Ce numéro est-il un numéro reviewer ACTIF ? (gate configuré ET numéro
 * whitelisté). otp-send s'en sert pour décider du skip-SMS — MÊME prédicat que
 * le login, donc jamais de skip-SMS sans code reviewer exploitable.
 */
export function isReviewerPhone(phoneE164: string, env: EnvReader): boolean {
  return isReviewerConfigured(env) && reviewerPhones(env).includes(phoneE164);
}

/**
 * Login reviewer complet : numéro reviewer actif ET code soumis == code attendu.
 * Un mauvais code retombe sur le flux normal (le numéro reste utilisable).
 */
export function isReviewerLogin(phoneE164: string, otpCode: string, env: EnvReader): boolean {
  return isReviewerPhone(phoneE164, env) && otpCode === reviewerCode(env);
}
