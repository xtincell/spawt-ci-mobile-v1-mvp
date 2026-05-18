// GoogleButton — Story 2.3a AC #1 (FR-001)
// Bouton secondaire "Continuer avec Google" rendu sous le bouton OTP primaire
// de `phone.tsx`. Utilise `expo-auth-session` (compatible Expo Go) + flux
// id_token implicit + nonce signé pour `supabase.auth.signInWithIdToken`.
//
// Pourquoi pas `@react-native-google-signin/google-signin` : exige un native
// build → incompatible avec Expo Go QR scan utilisé en alpha §5.8 (cf. Story
// 2.3 Dev Notes §2). Migration possible Sprint 2 post-EAS stable.
//
// Trade-off : ouverture WebView Auth (≈600 ms cold-start) vs native sheet
// Google (≈200 ms). Acceptable pour onboarding one-shot.
//
// Mode démo / config absente : graceful no-op + toast — pas de crash.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "../../theme/ThemeProvider";
import { track } from "../../lib/analytics";
import { isSupabaseConfigured } from "../../lib/data-source";
import { supabase } from "../../lib/supabase";

type Props = {
  onError?: (messageKey: string) => void;
};

function readClientId(key: "googleClientId" | "googleIosClientId" | "googleAndroidClientId"): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = typeof extra?.[key] === "string" ? (extra[key] as string) : undefined;
  if (fromExtra) return fromExtra;
  // ENV fallback : EXPO_PUBLIC_GOOGLE_CLIENT_ID etc.
  const envKey =
    key === "googleClientId"
      ? "EXPO_PUBLIC_GOOGLE_CLIENT_ID"
      : key === "googleIosClientId"
        ? "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
        : "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID";
  const fromEnv = process.env[envKey];
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : undefined;
}

// P-01 — Nonce CSPRNG via `expo-crypto.getRandomBytes` (CSPRNG natif iOS/Android
// + JSC/Hermes/web). `globalThis.crypto` n'est pas exposé par défaut sur RN
// Hermes — fallback sur la lib Expo qui marche partout. Renvoie null si la
// génération échoue (anti-replay OIDC casserait).
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

export function GoogleButton({ onError }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // P-02 — `WebBrowser.maybeCompleteAuthSession` doit être appelé une fois au
  // mount du screen Auth (pas au top-level du module : side-effect répété à
  // chaque import + hot-reload).
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // P-01 — Nonce CSPRNG ; si non disponible, on signale et on désactive le bouton.
  const [rawNonce] = useState<string | null>(() => generateSecureNonce());
  const [hashedNonce, setHashedNonce] = useState<string | null>(null);
  useEffect(() => {
    if (!rawNonce) return;
    let cancelled = false;
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce).then((hash) => {
      if (!cancelled) setHashedNonce(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [rawNonce]);

  const webClientId = useMemo(() => readClientId("googleClientId"), []);
  const iosClientId = useMemo(() => readClientId("googleIosClientId"), []);
  const androidClientId = useMemo(() => readClientId("googleAndroidClientId"), []);
  // P-03 — Platform-aware : un `iosClientId` truthy sur Android ne configure rien.
  // On exige le clientId de la plateforme courante OU le webClientId (PWA / dev).
  const platformClientId =
    Platform.OS === "ios" ? iosClientId : Platform.OS === "android" ? androidClientId : webClientId;
  const configured = Boolean(platformClientId || webClientId);

  // P-05 — Mémoïser le config object pour éviter une re-init de `useAuthRequest`
  // à chaque render (l'objet inline `{ ... }` change d'identité).
  const authRequestConfig = useMemo(
    () => ({
      ...(webClientId ? { clientId: webClientId } : {}),
      ...(iosClientId ? { iosClientId } : {}),
      ...(androidClientId ? { androidClientId } : {}),
      scopes: ["openid", "profile", "email"],
      responseType: "id_token" as const,
      ...(hashedNonce ? { extraParams: { nonce: hashedNonce } } : {}),
    }),
    [webClientId, iosClientId, androidClientId, hashedNonce],
  );

  // useAuthRequest accepte un objet partiel ; si aucun clientId, on évite
  // d'initialiser le flow (on retourne un bouton qui prévient l'utilisateur).
  const [request, response, promptAsync] = Google.useAuthRequest(authRequestConfig);

  // P-02 — Idempotency : `useEffect` peut firer plusieurs fois sur la même
  // `response` si le parent recrée `onError` à chaque render (no useCallback).
  // `processedResponseRef` garde l'id_token déjà traité ; second firing → no-op.
  const processedTokenRef = useRef<string | null>(null);

  // Gère la réponse Google une fois retournée par le WebView.
  useEffect(() => {
    if (!response) return;
    if (response.type !== "success") {
      if (response.type === "dismiss" || response.type === "cancel") {
        setBusy(false);
        return;
      }
      // P-04 — `error` ne propage rien sans `onError` — toast caller absent.
      if (response.type === "error") {
        setBusy(false);
        onError?.("auth.error_google_unavailable");
      }
      return;
    }
    const idToken =
      typeof response.params?.id_token === "string" ? response.params.id_token : null;
    if (!idToken || !rawNonce) {
      setBusy(false);
      onError?.("auth.error_google_unavailable");
      return;
    }
    // P-02 — gate idempotency.
    if (processedTokenRef.current === idToken) return;
    processedTokenRef.current = idToken;
    void (async () => {
      try {
        const { error: signInErr } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
          nonce: rawNonce,
        });
        if (signInErr) {
          if (__DEV__) console.warn("[google-button] signInWithIdToken failed", signInErr);
          onError?.("auth.error_google_unavailable");
          return;
        }
        track({
          name: "auth_signed_in",
          properties: { method: "google", demo: !isSupabaseConfigured },
        });
        router.push("/(onboarding)/profile");
      } finally {
        setBusy(false);
      }
    })();
  }, [response, rawNonce, router, onError]);

  // P-03 — gate sur `hashedNonce !== null` pour éviter une race entre tap user
  // et résolution `Crypto.digestStringAsync`. Sans nonce, Supabase rejette le
  // token en silence → bouton désactivé tant que le hash n'est pas calculé.
  const cryptoReady = rawNonce !== null;
  const nonceReady = hashedNonce !== null;
  const disabled = busy || !cryptoReady || !nonceReady;

  const onPress = useCallback(async () => {
    if (busy) return;
    // P-01 — si CSPRNG indisponible (env exotique sans `crypto.getRandomValues`),
    // hard-fail explicite plutôt que fallback `Math.random` qui défait l'anti-replay.
    if (!cryptoReady) {
      onError?.("auth.error_crypto_unavailable");
      return;
    }
    if (!isSupabaseConfigured) {
      onError?.("auth.demo_google_unavailable");
      return;
    }
    if (!configured) {
      onError?.("auth.error_google_unavailable");
      return;
    }
    // P-03 — gate explicite : la prop `disabled` couvre déjà ce cas mais la
    // garde défensive supprime toute fenêtre de race.
    if (!nonceReady) {
      onError?.("auth.error_google_unavailable");
      return;
    }
    if (!request) {
      onError?.("auth.error_google_unavailable");
      return;
    }
    setBusy(true);
    try {
      await promptAsync();
    } catch (err) {
      if (__DEV__) console.warn("[google-button] promptAsync failed", err);
      setBusy(false);
      onError?.("auth.error_google_unavailable");
    }
  }, [busy, configured, cryptoReady, nonceReady, onError, promptAsync, request]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID="auth-google-button"
      accessibilityRole="button"
      accessibilityLabel={t("auth.google")}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        marginTop: theme.spacing.base,
        backgroundColor: theme.colors.surface.raised,
        borderColor: theme.colors.border.strong,
        borderWidth: 1.5,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.base,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size.lg,
            fontWeight: theme.typography.weight.semibold,
          }}
        >
          {t("auth.google")}
        </Text>
      </View>
    </Pressable>
  );
}
