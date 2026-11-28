export interface EnvReader {
  get(name: string): string | undefined;
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
