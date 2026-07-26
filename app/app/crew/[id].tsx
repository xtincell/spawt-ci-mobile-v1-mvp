// Mode Crew — écran de session : le vote de groupe en direct.
//
// Le cas d'usage roi : « 3 heures de débat WhatsApp et 47 messages » → un vote
// de crew en 5 minutes. L'hôte partage le code (GROS, lisible dans un maquis
// bruyant), le crew rejoint en direct, chacun propose et vote, l'hôte tranche
// (« On tranche ») → révélation sobre du lieu gagnant.
//
// Temps réel : abonnement via crew-store.attach() (realtime → polling
// automatique, invisible ici). Compteurs de votes ANONYMES — qui a voté ne
// s'affiche jamais (sobriété sociale). Cleanup rigoureux à l'unmount (detach).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/ThemeProvider";
import { Button } from "../../src/components/primitives/Button";
import { Ico } from "../../src/components/primitives/Ico";
import { CrewPlacePicker } from "../../src/components/crew/CrewPlacePicker";
import { useCrewStore } from "../../src/store/crew-store";
import { useSpawterStore } from "../../src/store/spawter-store";
import {
  buildCrewInviteUrl,
  openWhatsAppWithMessage,
} from "../../src/lib/crew/crew-session";
import { track } from "../../src/lib/analytics";
import type { CrewSelf } from "../../src/lib/crew/crew-types";

// ─── Compte à rebours TTL ────────────────────────────────────────────────────

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Countdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(() => Date.parse(expiresAt) - Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Date.parse(expiresAt) - Date.now();
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
      <Ico name="clock" size={14} color={theme.colors.text.tertiary} />
      <Text
        style={{
          ...theme.typography.preset.caption,
          color: theme.colors.text.tertiary,
        }}
      >
        {t("crew.countdown_label")}
      </Text>
      <Text
        style={{
          ...theme.typography.preset.data,
          color:
            remaining < 5 * 60 * 1000
              ? theme.colors.state.warning
              : theme.colors.text.secondary,
        }}
      >
        {formatRemaining(remaining)}
      </Text>
    </View>
  );
}

// ─── Écran ───────────────────────────────────────────────────────────────────

export default function CrewSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const spawter = useSpawterStore((s) => s.spawter);

  const session = useCrewStore((s) => s.session);
  const members = useCrewStore((s) => s.members);
  const proposals = useCrewStore((s) => s.proposals);
  const winner = useCrewStore((s) => s.winner);
  const offline = useCrewStore((s) => s.offline);
  const busy = useCrewStore((s) => s.busy);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const spawterId = spawter?.id ?? null;

  // Ouverture + abonnement temps réel — cleanup strict à l'unmount.
  useEffect(() => {
    if (!id || !spawterId) return;
    const store = useCrewStore.getState();
    const sp = useSpawterStore.getState().spawter;
    if (!sp) return;
    const self: CrewSelf = {
      id: sp.id,
      display_name: sp.display_name,
      avatar_url: sp.avatar_url,
    };
    let cancelled = false;
    void store.open(id, self).then(() => {
      if (!cancelled) setLoadingInitial(false);
    });
    store.attach(id);
    return () => {
      cancelled = true;
      useCrewStore.getState().detach();
    };
  }, [id, spawterId]);

  const onExpired = useCallback(() => {
    void useCrewStore.getState().markExpired();
  }, []);

  const isHost = Boolean(session && spawterId && session.host_id === spawterId);

  const leaveAndGoBack = () => {
    void useCrewStore.getState().leave();
    router.back();
  };

  const onShareCode = () => {
    if (!session) return;
    track({
      name: "crew_code_shared",
      properties: { session_id: session.id },
    });
    openWhatsAppWithMessage(
      t("crew.share_invite", {
        code: session.code,
        url: buildCrewInviteUrl(session.code),
      }),
    );
  };

  const onShareResult = () => {
    if (!session || !winner) return;
    track({
      name: "crew_result_shared",
      properties: { session_id: session.id, place_id: winner.place_id },
    });
    openWhatsAppWithMessage(
      t("crew.share_result", {
        place: winner.place_name,
        neighborhood: winner.place_neighborhood,
        url: `https://spawt.ci/place/${winner.place_id}`,
      }),
    );
  };

  const onVote = async (proposalId: string) => {
    setActionError(null);
    const result = await useCrewStore.getState().castVote(proposalId);
    if (result === "error") setActionError(t("crew.vote_error"));
  };

  const onPropose = async (place: { id: string; name: string; neighborhood: string }) => {
    setPickerVisible(false);
    setActionError(null);
    const result = await useCrewStore.getState().propose(place);
    if (result === "duplicate") setActionError(t("crew.already_proposed"));
    else if (result === "error") setActionError(t("crew.propose_error"));
  };

  const onTrancher = async () => {
    setActionError(null);
    await useCrewStore.getState().trancher();
  };

  // ─── États hors session ────────────────────────────────────────────────────

  if (loadingInitial && !session) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.base,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.brand.primary} />
      </SafeAreaView>
    );
  }

  // Session introuvable (expirée + purgée, kill en démo…) ou expirée.
  if (!session || session.status === "expired") {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: theme.spacing["2xl"],
            gap: theme.spacing.md,
          }}
        >
          <Ico name="clock" size={64} color={theme.colors.brand.primary} />
          <Text
            style={{
              ...theme.typography.preset.h1,
              color: theme.colors.text.primary,
              textAlign: "center",
            }}
          >
            {t("crew.expired_title")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
              textAlign: "center",
            }}
          >
            {t("crew.expired_body")}
          </Text>
          <View style={{ alignSelf: "stretch", gap: theme.spacing.sm, marginTop: theme.spacing.base }}>
            <Button
              label={t("crew.cta_back_meute")}
              variant="secondary"
              onPress={leaveAndGoBack}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Révélation du gagnant ────────────────────────────────────────────────
  if (session.status === "resolved" && winner) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.inverse }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: theme.spacing["2xl"],
            gap: theme.spacing.md,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
            }}
          >
            {t("crew.reveal_kicker")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.text.inverse,
              textAlign: "center",
            }}
          >
            {winner.place_name}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.inverseSecondary,
              textAlign: "center",
            }}
          >
            {winner.place_neighborhood}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.data,
              color: theme.colors.text.inverse,
            }}
          >
            {t("crew.reveal_votes", { count: winner.votes })}
          </Text>
          {winner.decided_by === "host_palais" ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.inverseSecondary,
                textAlign: "center",
              }}
            >
              {t("crew.reveal_tiebreak_host")}
            </Text>
          ) : null}
          {winner.decided_by === "first_proposed" ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.inverseSecondary,
                textAlign: "center",
              }}
            >
              {t("crew.reveal_tiebreak_first")}
            </Text>
          ) : null}

          <View
            style={{
              alignSelf: "stretch",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.lg,
            }}
          >
            <Button
              label={t("crew.cta_see_place")}
              variant="gold"
              onPress={() => router.push(`/place/${winner.place_id}`)}
            />
            <Button
              label={t("crew.cta_spawt_there")}
              variant="secondary"
              onPress={() => router.push("/(tabs)/spawter")}
            />
            <Button
              label={t("crew.cta_share_result")}
              variant="ghost"
              onPress={onShareResult}
            />
            <Button
              label={t("crew.cta_back_meute")}
              variant="ghost"
              onPress={leaveAndGoBack}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Session ouverte : le vote en direct ──────────────────────────────────
  const alone = members.length <= 1;
  const hostGone = Boolean(
    session.host_id && !members.some((m) => m.spawter_id === session.host_id),
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.base }}
      >
        {/* Header : retour + titre + countdown */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ico name="arrow-left" size={22} color={theme.colors.text.primary} />
          </Pressable>
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.primary,
            }}
          >
            {t("crew.session_title")}
          </Text>
          <Countdown expiresAt={session.expires_at} onExpired={onExpired} />
        </View>

        {/* Bandeau offline + retry */}
        {offline ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface.subtle,
              borderWidth: 1,
              borderColor: theme.colors.state.warning,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.secondary,
                flex: 1,
              }}
            >
              {t("crew.offline_banner")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void useCrewStore.getState().refresh()}
            >
              <Text
                style={{
                  ...theme.typography.preset.caption,
                  color: theme.colors.brand.primary,
                }}
              >
                {t("crew.cta_retry")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Le code — GROS, partageable à l'oral comme sur WhatsApp */}
        <View
          style={{
            alignItems: "center",
            padding: theme.spacing.lg,
            borderRadius: theme.radius.card,
            backgroundColor: theme.colors.surface.inverse,
            gap: theme.spacing.xs,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.inverseSecondary,
            }}
          >
            {t("crew.code_label")}
          </Text>
          <Text
            testID="crew-code"
            style={{
              ...theme.typography.preset.display,
              fontSize: 48,
              lineHeight: 54,
              letterSpacing: 10,
              color: theme.colors.brand.primary,
            }}
          >
            {session.code}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.inverseSecondary,
            }}
          >
            {t("crew.code_hint")}
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: theme.spacing.sm }}>
            <Button
              label={t("crew.cta_share_code")}
              variant="gold"
              onPress={onShareCode}
            />
          </View>
        </View>

        {/* Les membres — arrivées en temps réel */}
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <Ico name="users" size={16} color={theme.colors.text.primary} />
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: theme.colors.text.primary,
              }}
            >
              {t("crew.members_title")}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.caption,
                color: theme.colors.text.tertiary,
              }}
            >
              {t("crew.members_count", { count: members.length })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
            {members.map((m) => (
              <View key={m.spawter_id} style={{ alignItems: "center", gap: 4, width: 56 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor:
                      m.spawter_id === session.host_id
                        ? theme.colors.brand.primary
                        : theme.colors.brand.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      ...theme.typography.preset.h3,
                      color:
                        m.spawter_id === session.host_id
                          ? theme.colors.text.onBrand
                          : theme.colors.text.inverse,
                    }}
                  >
                    {(m.display_name || "?").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    ...theme.typography.preset.caption,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {m.display_name}
                </Text>
              </View>
            ))}
          </View>
          {alone ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.tertiary,
              }}
            >
              {t("crew.alone_hint")}
            </Text>
          ) : null}
          {hostGone && !isHost ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.state.warning,
              }}
            >
              {t("crew.host_left")}
            </Text>
          ) : null}
        </View>

        {/* Les propositions — compteurs anonymes, votes en direct */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.primary,
            }}
          >
            {t("crew.proposals_title")}
          </Text>
          {proposals.length === 0 ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.tertiary,
              }}
            >
              {t("crew.proposals_empty")}
            </Text>
          ) : (
            proposals.map((p) => (
              <View
                key={p.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border.subtle,
                  backgroundColor: theme.colors.surface.raised,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...theme.typography.preset.body,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {p.place_name}
                  </Text>
                  <Text
                    style={{
                      ...theme.typography.preset.caption,
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {p.place_neighborhood}
                  </Text>
                </View>
                <Text
                  style={{
                    ...theme.typography.preset.data,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t("crew.votes_count", { count: p.votes })}
                </Text>
                {p.has_my_vote ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: theme.spacing.sm,
                    }}
                  >
                    <Ico name="check" size={16} color={theme.colors.state.success} />
                    <Text
                      style={{
                        ...theme.typography.preset.caption,
                        color: theme.colors.state.success,
                      }}
                    >
                      {t("crew.voted_label")}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void onVote(p.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.brand.accent,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        ...theme.typography.preset.caption,
                        color: theme.colors.text.inverse,
                      }}
                    >
                      {t("crew.cta_vote")}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))
          )}

          {actionError ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.state.danger,
              }}
            >
              {actionError}
            </Text>
          ) : null}

          <Button
            label={t("crew.cta_propose")}
            variant="secondary"
            onPress={() => setPickerVisible(true)}
          />
        </View>

        {/* L'hôte tranche */}
        {isHost ? (
          <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            <Button
              label={t("crew.host_cta_resolve")}
              variant="gold-grad"
              disabled={proposals.length === 0 || busy}
              onPress={() => void onTrancher()}
            />
            {proposals.length === 0 ? (
              <Text
                style={{
                  ...theme.typography.preset.caption,
                  color: theme.colors.text.tertiary,
                  textAlign: "center",
                }}
              >
                {t("crew.resolve_need_proposal")}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Button
          label={t("crew.cta_leave")}
          variant="ghost"
          onPress={leaveAndGoBack}
        />
      </ScrollView>

      <CrewPlacePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(place) => void onPropose(place)}
        alreadyProposedIds={new Set(proposals.map((p) => p.place_id))}
      />
    </SafeAreaView>
  );
}
