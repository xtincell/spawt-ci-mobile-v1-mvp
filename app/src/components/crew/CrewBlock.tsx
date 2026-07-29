// Mode Crew — bloc « Ton Crew » de l'onglet Meute (derrière le flag mode-crew).
//
// Deux entrées : lancer un vote (l'hôte crée la session et file sur l'écran
// de session pour partager le code) et rejoindre avec un code (5 chars).
// Une session non expirée persiste à travers un kill de l'app → carte
// « Reprendre le vote ».

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Button } from "../primitives/Button";
import { useCrewStore } from "../../store/crew-store";
import { useSpawterStore } from "../../store/spawter-store";
import type { CrewSelf } from "../../lib/crew/crew-types";

export function CrewBlock() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const spawter = useSpawterStore((s) => s.spawter);
  const busy = useCrewStore((s) => s.busy);
  const persistedRef = useCrewStore((s) => s.persistedRef);
  const hydrateFromStorage = useCrewStore((s) => s.hydrateFromStorage);
  const start = useCrewStore((s) => s.start);
  const join = useCrewStore((s) => s.join);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!spawter) return null;

  const self: CrewSelf = {
    id: spawter.id,
    display_name: spawter.display_name,
    avatar_url: spawter.avatar_url,
  };

  const onLaunch = async () => {
    setError(null);
    const ref = await start(self);
    if (ref) {
      router.push(`/crew/${ref.session_id}`);
    } else {
      setError(t("crew.launch_failed"));
    }
  };

  const onJoin = async () => {
    if (code.trim().length < 5) return;
    setError(null);
    const result = await join(code, self);
    if (result.ok) {
      setCode("");
      router.push(`/crew/${result.ref.session_id}`);
      return;
    }
    setError(
      result.reason === "session_closed"
        ? t("crew.join_error_closed")
        : result.reason === "session_not_found"
          ? t("crew.join_error_not_found")
          : t("crew.join_error_generic"),
    );
  };

  return (
    <View
      testID="crew-block"
      style={{
        marginHorizontal: theme.spacing.lg,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.sm,
        padding: theme.spacing.base,
        borderRadius: theme.radius.card,
        backgroundColor: theme.colors.surface.subtle,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        gap: theme.spacing.sm,
      }}
    >
      <Text
        style={{
          ...theme.typography.preset.h3,
          color: theme.colors.text.primary,
        }}
      >
        {t("crew.block_title")}
      </Text>
      <Text
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.secondary,
        }}
      >
        {t("crew.block_pitch")}
      </Text>

      {persistedRef ? (
        <Pressable
          testID="crew-resume"
          accessibilityRole="button"
          onPress={() => router.push(`/crew/${persistedRef.session_id}`)}
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface.raised,
            borderWidth: 1,
            borderColor: theme.colors.brand.primary,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
            }}
          >
            {t("crew.resume_label", { code: persistedRef.code })}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.brand.primary,
              marginTop: 2,
            }}
          >
            {t("crew.cta_resume")}
          </Text>
        </Pressable>
      ) : (
        <>
          {busy ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <ActivityIndicator color={theme.colors.brand.primary} />
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                }}
              >
                {t("crew.launching")}
              </Text>
            </View>
          ) : (
            <Button
              label={t("crew.cta_launch")}
              variant="gold"
              onPress={() => {
                void onLaunch();
              }}
            />
          )}

          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.tertiary,
              marginTop: theme.spacing.xs,
            }}
          >
            {t("crew.join_label")}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <TextInput
              testID="crew-join-input"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder={t("crew.join_placeholder")}
              placeholderTextColor={theme.colors.text.tertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              style={{
                flex: 1,
                ...theme.typography.preset.data,
                fontSize: 16,
                letterSpacing: 4,
                color: theme.colors.text.primary,
                borderWidth: 1,
                borderColor: theme.colors.border.strong,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                backgroundColor: theme.colors.surface.raised,
              }}
            />
            <Button
              label={t("crew.cta_join")}
              variant="secondary"
              disabled={code.trim().length < 5 || busy}
              onPress={() => {
                void onJoin();
              }}
            />
          </View>
        </>
      )}

      {error ? (
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.state.danger,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
