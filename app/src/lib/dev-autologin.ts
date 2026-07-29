// __DEV__-only helper : court-circuite l'onboarding OTP en signant un compte
// pré-créé côté Supabase (email/password), puis hydrate localement spawter + palais.
//
// Activation : 3 env vars EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL + _PASSWORD + _ENABLED=true
// dans `app/.env`. Sans ces vars, no-op. Jamais embarqué en prod (gate __DEV__).
//
// Pourquoi : la Edge Function `otp-send` requiert une clé API Termii non configurée
// en alpha. Cette fonction permet de tester l'app live Supabase sans grinder un OTP.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { isSupabaseConfigured } from "./data-source";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";

const FLAG_KEY = "spawt:dev_autologin:done";

interface DevAutologinResult {
  ok: boolean;
  spawter?: Spawter;
  palais?: UserPalais;
  reason?: string;
}

export async function devAutologin(): Promise<DevAutologinResult> {
  if (!__DEV__) return { ok: false, reason: "not_dev" };
  if (!isSupabaseConfigured) return { ok: false, reason: "supabase_not_configured" };

  const enabled = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_ENABLED === "true";
  if (!enabled) return { ok: false, reason: "disabled" };

  const email = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_PASSWORD;
  if (!email || !password) return { ok: false, reason: "missing_credentials" };

  // 1. Si déjà signé in (session existante), juste hydrater
  let session = (await supabase.auth.getSession()).data.session;

  if (!session) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[dev-autologin] signIn failed", error.message);
      return { ok: false, reason: error.message };
    }
    session = data.session;
  }
  if (!session) return { ok: false, reason: "no_session_after_signin" };

  // 2. Fetch spawter + palais via RLS (id = auth.uid())
  const [{ data: spawter, error: spErr }, { data: palais, error: paErr }] = await Promise.all([
    supabase.from("spawters").select("*").eq("id", session.user.id).maybeSingle<Spawter>(),
    supabase.from("user_palais").select("*").eq("spawter_id", session.user.id).maybeSingle<UserPalais>(),
  ]);

  if (spErr || paErr) {
    // eslint-disable-next-line no-console
    console.warn("[dev-autologin] fetch failed", spErr ?? paErr);
    return { ok: false, reason: "fetch_failed" };
  }
  if (!spawter || !palais) {
    return { ok: false, reason: "spawter_or_palais_missing_in_db" };
  }

  // 3. Persist en local pour que le hydrate() suivant les retrouve.
  await Promise.all([
    AsyncStorage.setItem("spawt:spawter", JSON.stringify(spawter)),
    AsyncStorage.setItem("spawt:palais", JSON.stringify(palais)),
    AsyncStorage.setItem(FLAG_KEY, new Date().toISOString()),
  ]);

  return { ok: true, spawter, palais };
}

/** À appeler une fois — si déjà fait dans cette installation, no-op. */
export async function maybeDevAutologin(): Promise<DevAutologinResult> {
  if (!__DEV__) return { ok: false, reason: "not_dev" };
  const flag = await AsyncStorage.getItem(FLAG_KEY);
  if (flag) return { ok: false, reason: "already_done" };
  return devAutologin();
}
