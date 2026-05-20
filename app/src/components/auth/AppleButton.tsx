// AppleButton — Story 2.3a AC #2 (FR-001)
// Bouton secondaire "Continuer avec Apple" rendu sous Google sur `phone.tsx`.
// iOS uniquement (Platform.OS + `isAvailableAsync()`). Sur Android : rend null.
//
// Design Apple §4.0 Style Guide : utilise le composant natif
// `AppleAuthenticationButton` (logo + fond noir + texte blanc auto-géré).
//
// Pre-fill display_name + email : Apple ne renvoie `credential.fullName` ET
// `credential.email` QU'À la première authentification (politique Apple
// permanente). On les pousse immédiatement dans `useOnboardingDraft` pour que
// Story 2.4 puisse les pré-remplir (Story 2.3 Dev Notes §7).
//
// Annulation (`CANCELED`) : retour silencieux, pas de toast.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

import { useTheme } from "../../theme/ThemeProvider";
import { useOnboardingDraft } from "../../store/onboarding-draft";
import { track } from "../../lib/analytics";
import { isSupabaseConfigured } from "../../lib/data-source";
import { supabase } from "../../lib/supabase";

type Props = {
  onError?: (messageKey: string) => void;
};

// P-01 — Nonce CSPRNG via `expo-crypto.getRandomBytes` (CSPRNG natif iOS).
// `globalThis.crypto` n'est pas exposé par défaut sur RN Hermes — fallback sur
// la lib Expo qui marche partout. Anti-replay OIDC strict ; null si KO.
function generateSecureNonce(): string | null {
  try {
    const bytes = Crypto.getRandomBytes(16);
    if (!bytes || bytes.length !== 16) return null;
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

// P-28 — Cap les graphèmes : Apple peut renvoyer un nom de 100+ chars dans
// certaines cultures, mais ProfileScreen borne à 50 graphèmes (`profile.tsx`).
// On capture la même limite à la source pour ne pas pousser un draft hors-borne.
const DISPLAY_NAME_MAX_GRAPHEMES = 50;
function capGraphemes(str: string, max: number): string {
  const chars = Array.from(str);
  if (chars.length <= max) return str;
  return chars.slice(0, max).join("");
}

export function AppleButton({ onError }: Props) {
  // Mode démo (pas de Supabase) : pas d'auth possible → ne pas mount.
  if (!isSupabaseConfigured) return null;

  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const setDraftField = useOnboardingDraft((s) => s.setField);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAvailable(ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onPress = useCallback(async () => {
    if (busy) return;
    // P-01 — CSPRNG strict : si indisponible, hard-fail. Un nonce prédictible
    // permet le replay d'un identityToken Apple volé.
    const rawNonce = generateSecureNonce();
    if (!rawNonce) {
      onError?.("auth.error_crypto_unavailable");
      return;
    }
    if (!isSupabaseConfigured) {
      onError?.("auth.demo_apple_unavailable");
      return;
    }
    setBusy(true);

    // Nonce raw + hash SHA256 (Apple exige le hash dans la requête, Supabase
    // exige le raw pour valider). Pattern Supabase/Apple standard.
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const idToken = credential.identityToken;
      if (!idToken) {
        onError?.("auth.error_apple_unavailable");
        setBusy(false);
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: idToken,
        nonce: rawNonce,
      });
      if (signInErr) {
        if (__DEV__) console.warn("[apple-button] signInWithIdToken failed", signInErr);
        onError?.("auth.error_apple_unavailable");
        setBusy(false);
        return;
      }

      // Pre-fill display_name — Apple ne renvoie ces champs qu'à la 1re auth.
      // P-27 — Ne pas écraser un display_name déjà saisi (si user a déjà rempli
      // ProfileScreen puis est revenu en arrière pour Apple Sign-In).
      // P-28 — Cap à 50 graphèmes (ProfileScreen valide ce même seuil).
      const existingName = useOnboardingDraft.getState().draft.display_name;
      const givenName = credential.fullName?.givenName?.trim() ?? "";
      const familyName = credential.fullName?.familyName?.trim() ?? "";
      const composed = `${givenName} ${familyName}`.trim();
      if (composed.length > 0 && (!existingName || existingName.length === 0)) {
        setDraftField("display_name", capGraphemes(composed, DISPLAY_NAME_MAX_GRAPHEMES));
      }
      // P-04 — Apple ne renvoie `credential.email` qu'à la 1re connexion.
      // On persiste dans le draft pour account recovery / changement de device.
      const email = credential.email?.trim();
      if (typeof email === "string" && email.length > 0) {
        setDraftField("email", email);
      }

      // P-05 — flag `demo` aligné `events.md` ligne 128.
      track({
        name: "auth_signed_in",
        properties: { method: "apple", demo: !isSupabaseConfigured },
      });
      router.push("/(onboarding)/profile");
    } catch (err) {
      const code = (err as { code?: string }).code;
      // ERR_CANCELED / ERR_REQUEST_CANCELED : retour silencieux UX standard.
      if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
        setBusy(false);
        return;
      }
      if (__DEV__) console.warn("[apple-button] signInAsync failed", err);
      onError?.("auth.error_apple_unavailable");
    } finally {
      setBusy(false);
    }
  }, [busy, onError, router, setDraftField]);

  if (Platform.OS !== "ios" || available !== true) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={theme.radius.lg}
      style={{
        marginTop: theme.spacing.base,
        height: 48,
        width: "100%",
      }}
      onPress={() => void onPress()}
      testID="auth-apple-button"
      accessibilityLabel={t("auth.apple")}
      accessibilityState={{ disabled: busy }}
    />
  );
}
