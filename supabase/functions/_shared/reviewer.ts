export interface EnvReader {
  get(name: string): string | undefined;
}

// NANPA-reserved fictitious number, not a real line. Never use ordinary OTP for it.
export const RESERVED_STORE_REVIEWER_PHONE = "+12025550117";
export function isReservedStoreReviewerPhone(phoneE164: string): boolean {
  return phoneE164 === RESERVED_STORE_REVIEWER_PHONE;
}

const phonePattern = /^\+[1-9]\d{8,14}$/;
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const codePattern = /^\d{6}$/;

export function reviewerIdentity(env: EnvReader): { phone: string; userId: string } | null {
  const phone = env.get("REVIEWER_PHONE_E164")?.trim() ?? "";
  const userId = env.get("REVIEWER_USER_ID")?.trim().toLowerCase() ?? "";
  const code = env.get("REVIEWER_OTP_CODE") ?? "";
  if (!phonePattern.test(phone) || !uuidPattern.test(userId) ||
      !codePattern.test(code) || code === "123456") return null;
  return { phone, userId };
}

export function isReviewerConfigured(env: EnvReader): boolean {
  return reviewerIdentity(env) !== null;
}

export function isReviewerPhone(phoneE164: string, env: EnvReader): boolean {
  return reviewerIdentity(env)?.phone === phoneE164;
}

export function isReviewerLogin(phoneE164: string, otpCode: string, env: EnvReader): boolean {
  return isReviewerPhone(phoneE164, env) && otpCode === env.get("REVIEWER_OTP_CODE");
}

// Read only the dedicated, owner-readable runtime file for the fictitious account.
// It is created on the server, never committed or exposed through an API.
export function storeReviewerRuntimeEnv(
  phone: string,
  standard: EnvReader,
  readPrivateFile: (path: string) => string,
): EnvReader {
  if (!isReservedStoreReviewerPhone(phone)) return standard;
  const disabled: EnvReader = { get: () => undefined };
  try {
    const cfg: unknown = JSON.parse(readPrivateFile("/home/deno/functions/_shared/.store-reviewer.json"));
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return disabled;
    const v = cfg as Record<string, unknown>;
    if (v.phone !== RESERVED_STORE_REVIEWER_PHONE ||
        typeof v.userId !== "string" || typeof v.code !== "string") return disabled;
    const values: Record<string, string> = {
      REVIEWER_PHONE_E164: v.phone,
      REVIEWER_USER_ID: v.userId,
      REVIEWER_OTP_CODE: v.code,
    };
    const configured: EnvReader = { get: name => values[name] };
    return reviewerIdentity(configured) ? configured : disabled;
  } catch {
    return disabled;
  }
}
