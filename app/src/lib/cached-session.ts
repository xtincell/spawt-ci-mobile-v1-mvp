import { supabase } from "./supabase";
import { withReadTimeout } from "./data-read-error";

/** The cached profile is not proof of an authenticated SDK identity.
 * A transport failure is indeterminate: preserve the disk and retry, never
 * reinterpret it as a sign-out or publish another account's private cache. */
export async function canPublishCachedAccount(owner: string): Promise<boolean> {
  try {
    const { data, error } = await withReadTimeout("session", () => supabase.auth.getSession());
    if (error) throw error;
    return data.session?.user.id === owner;
  } catch {
    throw new Error("ACCOUNT_SESSION_UNAVAILABLE");
  }
}
