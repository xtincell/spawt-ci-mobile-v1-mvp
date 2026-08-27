// Étape OTP — Story 2.3 (FR-001) + #V07 (MAJ consolidée 07/2026)
// 6 cases auto-advance + auto-submit au 6e chiffre — aligné sur le pin Termii
// (otp-send envoie pin_length: 6). Tant que le serveur est en mock
// (MOCK_TERMII non désactivé), le code universel `123456` est accepté — la
// même longueur en mock et en réel évite un écran qui change à la bascule.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doitEnvoyerLeCode } from "../../src/lib/otp-submit-guard";
import {
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { track } from "../../src/lib/analytics";
import { isSupabaseConfigured } from "../../src/lib/data-source";
import {
  backendAnonKey,
  backendUrl,
  empreinteBackend,
} from "../../src/lib/backend-identity";
import { supabase } from "../../src/lib/supabase";

const CELL_COUNT = 6;
const RESEND_COOLDOWN_S = 30;
const DEMO_CODE = "123456";

// P11 — mask phone for analytics (`+225 XXXXXX 12` style) — pareil que phone.tsx.
// P-16 round 3 — Si le phone est trop court (deep-link malformé, troncation),
// on retourne `"REDACTED"` plutôt que le numéro en clair pour ne pas le leak
// dans les events analytics.
function maskPhone(p: string): string {
  if (p.length < 6) return "REDACTED";
  const head = p.slice(0, 4);
  const tail = p.slice(-2);
  return `${head} ${"X".repeat(Math.max(0, p.length - 6))} ${tail}`;
}

export default function OtpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; demo?: string; mock?: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  // D5 — gate strict : `?demo=1` n'est honoré QUE si le backend Supabase n'est
  // pas configuré. Empêche un deep-link prod de bypasser la session live.
  const demoMode = params.demo === "1" && !isSupabaseConfigured;
  // Backend réel, mais envoi de SMS pas encore branché côté serveur : l'app
  // doit le dire plutôt que de faire attendre un SMS qui ne partira pas.
  const mockSms = params.mock === "1";
  const setDraftField = useOnboardingDraft((s) => s.setField);

  const refs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(CELL_COUNT).fill(""));
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Détail technique affiché sous l'erreur, en clair, y compris dans un binaire
  // distribué. Sans lui, trois échecs très différents — pas de jetons, session
  // refusée, exception — s'affichaient tous « Pas de réseau », et la vraie
  // raison n'était journalisée que sous __DEV__, donc jamais là où on en a
  // besoin. Une personne bloquée peut désormais lire ce code et le transmettre.
  const [detail, setDetail] = useState<string | null>(null);
  // Le verrou doit être SYNCHRONE. `submitting` est un état : il n'est visible
  // qu'au rendu suivant, donc deux appels partis dans le même tour le lisent
  // tous les deux à false. Une ref change tout de suite.
  const submittingRef = useRef(false);
  // Un code donné ne part qu'UNE fois. Sans ça, l'auto-envoi se rejoue dès que
  // le verrou retombe alors que les 6 chiffres sont toujours à l'écran.
  const codeDejaTenteRef = useRef<string | null>(null);

  const code = useMemo(() => digits.join(""), [digits]);
  const ready = code.length === CELL_COUNT;
  const friction = attempts >= 3;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // ⚠️ Cet effet dépendait de `submitting`. À la fin d'une vérification, le
  // verrou retombe à false — l'effet se redéclenchait donc alors que les 6
  // chiffres étaient toujours saisis, et RENVOYAIT LE MÊME CODE.
  //
  // Vu sur la base : une seule ligne `otp_attempts` par demande, validée une
  // fois — et l'utilisateur voyait quand même « Aucun code en cours ». La
  // première requête consommait l'OTP et ouvrait la session ; la seconde ne
  // trouvait plus rien, et son erreur écrasait le succès à l'écran. Connexion
  // réussie côté serveur, échec affiché côté app.
  //
  // On ne dépend donc plus du verrou, et un code donné ne part qu'une fois.
  useEffect(() => {
    const feuVert = doitEnvoyerLeCode({
      complet: ready,
      friction,
      enCours: submittingRef.current,
      code,
      codeDejaTente: codeDejaTenteRef.current,
    });
    if (!feuVert) return;
    codeDejaTenteRef.current = code;
    void onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, friction, code]);

  const onChangeCell = (index: number, value: string) => {
    // P-16 — supporte le paste de N digits : si la value contient plusieurs
    // chiffres, on les distribue à partir de cell[0] (pas de l'index courant)
    // pour éviter de clobber les premiers digits quand iOS auto-fill SMS dump
    // arrive dans une cellule au milieu.
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      const digitsPasted = clean.slice(0, CELL_COUNT).split("");
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < digitsPasted.length && i < CELL_COUNT; i++) {
          const d = digitsPasted[i];
          if (typeof d === "string") next[i] = d;
        }
        return next;
      });
      const lastFilled = Math.min(digitsPasted.length - 1, CELL_COUNT - 1);
      refs.current[lastFilled]?.focus();
      return;
    }
    const ch = clean.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = ch;
      return next;
    });
    if (ch && index < CELL_COUNT - 1) refs.current[index + 1]?.focus();
  };

  const onKeyPress = (
    index: number,
    e: { nativeEvent: { key: string } },
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const reset = () => {
    setDigits(Array(CELL_COUNT).fill(""));
    // Le champ est vidé : la prochaine saisie, même identique, doit repartir.
    codeDejaTenteRef.current = null;
    refs.current[0]?.focus();
  };

  // P-13 — flag d'unmount + AbortControllers stables pour annuler tout fetch
  // en cours quand le composant unmount.
  // P-13 round 3 — Séparer submit vs resend : un tap rapide submit → resend
  // tuait le fetch précédent et confondait l'UX (les 2 set des erreurs
  // différentes). Chaque flow a maintenant son propre controller.
  const mountedRef = useRef(true);
  const submitAbortRef = useRef<AbortController | null>(null);
  const resendAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort();
      submitAbortRef.current = null;
      resendAbortRef.current?.abort();
      resendAbortRef.current = null;
    };
  }, []);

  const onSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setDetail(null);

    // P-13 — abort un éventuel fetch submit précédent encore en vol.
    submitAbortRef.current?.abort();
    const abort = new AbortController();
    submitAbortRef.current = abort;

    try {
      if (demoMode) {
        if (code !== DEMO_CODE) {
          // P-12 round 3 — `submitting` gate empêche le double-tap ; simple
          // read+set suffit, le functional setter alambiqué (P-19 round 2) est
          // remplacé par cette forme directe et lisible.
          const nextAttempts = attempts + 1;
          setAttempts(nextAttempts);
          if (mountedRef.current) setError(t("auth.error_invalid_otp"));
          track({
            name: "auth_otp_validated",
            properties: { method: "phone", success: false, attempts: nextAttempts, demo: true },
          });
          reset();
          return;
        }
        setDraftField("phone_e164", phone);
        track({
          name: "auth_otp_validated",
          properties: { method: "phone", demo: true, success: true },
        });
        track({ name: "auth_signed_in", properties: { method: "phone", demo: true } });
        track({
          name: "onboarding_step_completed",
          properties: { step: "phone", step_index: 2 },
        });
        router.push("/(onboarding)/profile");
        return;
      }

      const url = backendUrl.valeur;
      const anonKey = backendAnonKey.valeur;
      // ⚠️ Cet appel n'avait AUCUN délai d'attente — contrairement à l'envoi
      // du code, borné à 30 s. Sur une connexion mobile qui traîne, la requête
      // pouvait rester en vol indéfiniment : bouton figé, aucun retour.
      //
      // Et une coupure passagère suffisait à renvoyer la personne à la case
      // départ. L'app est faite pour Abidjan, en mobile : un réseau qui vacille
      // est le cas NORMAL, pas l'exception. On retente donc une fois, en
      // silence, avant de déclarer forfait.
      const VERIFY_TIMEOUT_MS = 30_000;
      const appelVerify = async (): Promise<Response> => {
        const minuterie = setTimeout(() => abort.abort(), VERIFY_TIMEOUT_MS);
        try {
          return await fetch(`${url}/functions/v1/otp-verify`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              apikey: anonKey,
              authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ phone_e164: phone, otp_code: code }),
            signal: abort.signal,
          });
        } finally {
          clearTimeout(minuterie);
        }
      };

      let resp: Response;
      try {
        resp = await appelVerify();
      } catch (premierEchec) {
        // Un abort volontaire (démontage, nouvelle soumission) ne se retente
        // pas : seule une panne de transport mérite une seconde chance.
        if (abort.signal.aborted) throw premierEchec;
        if (!mountedRef.current) throw premierEchec;
        setError(t("auth.error_network_retry"));
        resp = await appelVerify();
      }

      if (!mountedRef.current) return;

      if (resp.status === 401 || resp.status === 400) {
        // P-12 — distinguer les codes d'erreur côté UX. Le body est typé
        // `{error: "invalid_otp" | "no_pending_otp" | "otp_already_used" | ...}`.
        let serverError: string | null = null;
        try {
          const body = (await resp.clone().json()) as { error?: string };
          serverError = body.error ?? null;
        } catch {
          // ignore — fallback message générique.
        }
        // P-12 round 3 — simple read+set (gate `submitting` suffit).
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        const messageKey =
          serverError === "no_pending_otp"
            ? "auth.error_otp_expired"
            : serverError === "otp_already_used"
              ? "auth.error_otp_already_used"
              : "auth.error_invalid_otp";
        setError(t(messageKey));
        track({
          name: "auth_otp_validated",
          properties: { method: "phone", success: false, attempts: nextAttempts },
        });
        reset();
        return;
      }
      if (resp.status === 429) {
        setError(t("auth.error_rate_limited"));
        return;
      }
      if (!resp.ok) {
        // Un 5xx dit « le serveur a échoué », pas « tu n'as pas de réseau ».
        // Les confondre envoyait chercher la panne du mauvais côté.
        setError(t(resp.status >= 500 ? "auth.error_server" : "auth.error_network"));
        return;
      }

      // Story 2.3a AC #3 — lit les tokens server-issued et ouvre la session
      // Supabase Auth côté SDK. Sans ça, `spawter-store.finalizeOnboarding`
      // throw FINALIZE_NO_AUTH_USER en mode live (review D2).
      const body = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        user_id?: string;
        // Chantier 13 archétypes — héritage quiz « La Meute » (claim par
        // téléphone côté Edge, migration 0033). Optionnel et ignorable.
        meute_heritage?: {
          claimed?: boolean;
          archetype?: string | null;
          pionnier_seq?: number | null;
        } | null;
      };
      if (!body.access_token || !body.refresh_token) {
        setError(t("auth.error_no_tokens"));
        setDetail("OTP-1 · missing_tokens");
        return;
      }
      // Deux chemins indépendants pour ouvrir la session, parce qu'un seul ne
      // suffit pas dans la vraie vie.
      //
      // `setSession` valide le jeton en appelant GET /auth/v1/user. Or ce jeton
      // vient d'être émis par NOTRE propre Edge Function, après vérification du
      // code : le revalider côté client n'apprend rien et ajoute un aller-retour
      // réseau de plus — un point de rupture pour rien.
      //
      // Observé sur un téléphone à Abidjan : le code est validé, la session est
      // créée en base, et cet appel-là échoue en « Unauthorized ». Le même appel
      // rejoué depuis ailleurs, avec la même bibliothèque et le même compte,
      // renvoie 200. Quelque chose entre l'appareil et /auth/v1/user refuse.
      //
      // `refreshSession` n'emprunte PAS ce chemin : il ne touche que
      // /auth/v1/token, et enregistre la session de la même façon. On s'en sert
      // comme second essai. Si l'un des deux passe, la personne entre.
      let { error: sessionErr } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (sessionErr) {
        const { error: repliErr } = await supabase.auth.refreshSession({
          refresh_token: body.refresh_token,
        });
        // Le repli a ouvert la session : on oublie l'échec du premier chemin.
        if (!repliErr) sessionErr = null;
      }
      if (sessionErr) {
        // La raison ne doit PAS rester derrière __DEV__ : c'est précisément
        // dans un APK distribué qu'on en a besoin.
        //
        // `sessionErr.message` seul ne suffit pas : « Unauthorized » est le
        // texte de statut HTTP, il ne dit ni QUELLE couche refuse ni pourquoi.
        // On refait donc l'appel que setSession vient de faire — GET /user avec
        // le jeton — et on rapporte le statut et le début du corps. C'est la
        // différence entre « le serveur a dit non » et « quelque chose sur le
        // trajet a dit non », et les deux n'ont pas le même correctif.
        //
        // Ce que dit l'empreinte, et pourquoi elle est décisive ici.
        //
        // `/functions/v1/*` ne vérifie AUCUNE clé au niveau de la passerelle :
        // envoyer et vérifier le code marche donc même avec une clé fausse.
        // `/auth/v1/*`, lui, est derrière `key-auth`. Mesuré sur le serveur
        // réel, une seule et unique forme de requête produit
        // `401 {"message":"Unauthorized"}` : une clé `apikey` que la passerelle
        // ne connaît pas. Le statut ne suffit donc pas — il faut savoir QUELLE
        // clé le binaire installé porte, et d'où elle vient.
        let sonde = "";
        try {
          const r = await fetch(`${url}/auth/v1/user`, {
            headers: {
              apikey: anonKey,
              authorization: `Bearer ${body.access_token}`,
            },
          });
          sonde = ` | ${empreinteBackend()} | GET /user → ${r.status} ${(await r.text()).slice(0, 50)}`;
        } catch (e) {
          sonde =
            ` | ${empreinteBackend()} | GET /user injoignable : ` +
            String((e as { message?: string })?.message ?? e).slice(0, 50);
        }
        // L'écart d'horloge du téléphone décide du chemin que prend setSession
        // (validation directe, ou rafraîchissement s'il croit le jeton périmé).
        const charge = JSON.parse(
          globalThis.atob(body.access_token.split(".")[1] ?? ""),
        ) as { iat?: number; exp?: number };
        const ecartS = Math.round(Date.now() / 1000) - (charge.iat ?? 0);
        setError(t("auth.error_session_open"));
        setDetail(
          `OTP-2 · ${String(sessionErr.message ?? sessionErr).slice(0, 60)}` +
            ` | statut ${String((sessionErr as { status?: number }).status ?? "?")}` +
            ` | horloge ${ecartS >= 0 ? "+" : ""}${ecartS}s${sonde}`,
        );
        return;
      }

      setDraftField("phone_e164", phone);
      // Chantier 13 archétypes — si l'héritage quiz a été réclamé, on le
      // stashe dans le draft : finalizeOnboarding en fera l'archétype INITIAL
      // (au lieu du calcul calibration) + persistera pionnier_seq. En mode
      // démo (demoMode plus haut), pas d'héritage — comportement inchangé.
      if (body.meute_heritage?.claimed === true) {
        setDraftField("meute_heritage", {
          claimed: true,
          archetype:
            typeof body.meute_heritage.archetype === "string"
              ? body.meute_heritage.archetype
              : null,
          pionnier_seq:
            typeof body.meute_heritage.pionnier_seq === "number"
              ? body.meute_heritage.pionnier_seq
              : null,
        });
      }
      track({ name: "auth_otp_validated", properties: { method: "phone", success: true } });
      track({ name: "auth_signed_in", properties: { method: "phone" } });
      track({
        name: "onboarding_step_completed",
        properties: { step: "phone", step_index: 2 },
      });
      router.push("/(onboarding)/profile");
    } catch (err) {
      // AbortError suite à unmount → silence.
      if ((err as { name?: string })?.name === "AbortError") return;
      if (!mountedRef.current) return;
      setError(t("auth.error_network"));
      setDetail(`OTP-3 · ${String((err as { message?: string })?.message ?? err).slice(0, 120)}`);
    } finally {
      // Ne pas reset l'abortRef si un autre call l'a déjà remplacé.
      if (submitAbortRef.current === abort) submitAbortRef.current = null;
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }, [attempts, code, demoMode, phone, router, setDraftField, t]);

  const onResend = useCallback(async () => {
    if (cooldown > 0) return;
    // P-15 round 3 — reset l'erreur précédente avant de relancer un envoi.
    setError(null);
    // P-11 + P-12 — track avec phone_masked + call effectif otp-send en live.
    track({
      name: "auth_otp_sent",
      properties: {
        phone_masked: maskPhone(phone),
        resend: true,
        ...(demoMode ? { demo: true } : {}),
      },
    });
    if (demoMode) {
      // P-14 — en démo, cooldown immédiat (pas de réseau à attendre).
      setCooldown(RESEND_COOLDOWN_S);
      // P-17 — reset attempts pour ne pas garder la friction post-resend.
      setAttempts(0);
      reset();
      return;
    }
    // P-15 — AbortController dédié resend pour ne pas tuer un submit en vol.
    resendAbortRef.current?.abort();
    const abort = new AbortController();
    resendAbortRef.current = abort;
    try {
      const url = backendUrl.valeur;
      const anonKey = backendAnonKey.valeur;
      const resp = await fetch(`${url}/functions/v1/otp-send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ phone_e164: phone }),
        signal: abort.signal,
      });
      if (!mountedRef.current) return;
      // P-14 — cooldown SEULEMENT après ok ; en cas d'échec, ne pas bloquer.
      if (resp.ok) {
        setCooldown(RESEND_COOLDOWN_S);
        // P-17 — reset attempts pour ne pas garder la friction post-resend.
        setAttempts(0);
        reset();
      } else if (resp.status === 429) {
        setError(t("auth.error_rate_limited"));
      } else {
        setError(t("auth.error_network"));
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (__DEV__) console.warn("[otp] resend fetch failed", err);
      if (mountedRef.current) setError(t("auth.error_network"));
    } finally {
      if (resendAbortRef.current === abort) resendAbortRef.current = null;
    }
  }, [cooldown, demoMode, phone, t]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("auth.otp_title")}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("auth.otp_body")}
        </Text>

        <View style={{ flexDirection: "row", gap: theme.spacing.xs, justifyContent: "center" }}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChangeText={(v) => onChangeCell(i, v)}
              onKeyPress={(e) => onKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === "android" ? "sms-otp" : undefined}
              testID={`otp-cell-${i}`}
              // 8 cases doivent tenir sur un écran 360dp : cases fluides
              // (flex) bornées à 44dp, au lieu d'une largeur fixe.
              // minWidth 0 : sur web, min-width:auto des flex items bloque le
              // rétrécissement des <input> → débordement ; sans effet sur Yoga.
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 44,
                height: 52,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface.raised,
                color: theme.colors.text.primary,
                fontSize: theme.typography.size.xl,
                textAlign: "center",
              }}
            />
          ))}
        </View>

        {demoMode || mockSms ? (
          <Text
            style={{
              marginTop: theme.spacing.base,
              textAlign: "center",
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.size.sm,
            }}
          >
            {t(demoMode ? "auth.otp_demo_hint" : "auth.otp_mock_hint")}
          </Text>
        ) : null}

        {error ? (
          <Text
            style={{
              marginTop: theme.spacing.sm,
              textAlign: "center",
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
            }}
          >
            {error}
          </Text>
        ) : null}

        {detail ? (
          <Text
            selectable
            testID="otp-detail"
            style={{
              marginTop: theme.spacing.xs,
              textAlign: "center",
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.size.xs,
            }}
          >
            {detail}
          </Text>
        ) : null}

        {/* AC #6 (Story 2.3a) — quand friction, Resend + Change phone sont
            rendus DANS le panneau pour matcher la spec Story 2.3 AC #2. */}
        {(() => {
          const actions = (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: theme.spacing.lg,
              }}
            >
              <Pressable
                onPress={onResend}
                disabled={cooldown > 0}
                testID="otp-resend"
                accessibilityRole="button"
                accessibilityState={{ disabled: cooldown > 0 }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color:
                      cooldown > 0 ? theme.colors.text.tertiary : theme.colors.brand.accent,
                    textDecorationLine: "underline",
                  }}
                >
                  {cooldown > 0
                    ? t("auth.otp_resend_cooldown", { seconds: cooldown })
                    : t("auth.otp_resend")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                testID="otp-change-phone"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.brand.accent,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("auth.otp_change_phone")}
                </Text>
              </Pressable>
            </View>
          );

          if (friction) {
            return (
              <View
                testID="otp-friction"
                style={{
                  marginTop: theme.spacing.lg,
                  padding: theme.spacing.base,
                  backgroundColor: theme.colors.surface.subtle,
                  borderRadius: theme.radius.lg,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.h3,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t("auth.otp_friction_title")}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.secondary,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  {t("auth.otp_friction_body")}
                </Text>
                {actions}
              </View>
            );
          }

          return actions;
        })()}
      </View>
    </KeyboardAvoidingView>
  );
}
