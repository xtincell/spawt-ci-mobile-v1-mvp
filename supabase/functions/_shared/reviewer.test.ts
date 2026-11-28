import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { isReviewerConfigured, isReviewerLogin, isReviewerPhone } from "./reviewer.ts";
const base = {
  REVIEWER_PHONE_E164: "+2250700000001",
  REVIEWER_USER_ID: "cf28de11-2766-4ec4-8948-73047aaa086f",
  REVIEWER_OTP_CODE: "424242",
};
function env(vars: Record<string, string | undefined>) {
  return { get: (name: string) => vars[name] };
}
Deno.test("reviewer config fails closed without dedicated UUID, single E.164 or valid non-default code", () => {
  for (const overrides of [
    { REVIEWER_USER_ID: undefined }, { REVIEWER_USER_ID: "invalid" },
    { REVIEWER_PHONE_E164: "+2250700000001,+2250700000002" },
    { REVIEWER_OTP_CODE: "42" }, { REVIEWER_OTP_CODE: "123456" },
  ]) assertEquals(isReviewerConfigured(env({ ...base, ...overrides })), false);
});
Deno.test("only the dedicated phone and its exact code match", () => {
  const cfg = env(base);
  assertEquals(isReviewerPhone(base.REVIEWER_PHONE_E164, cfg), true);
  assertEquals(isReviewerLogin(base.REVIEWER_PHONE_E164, base.REVIEWER_OTP_CODE, cfg), true);
  assertEquals(isReviewerLogin(base.REVIEWER_PHONE_E164, "424243", cfg), false);
  assertEquals(isReviewerLogin("+2250700000002", base.REVIEWER_OTP_CODE, cfg), false);
});
