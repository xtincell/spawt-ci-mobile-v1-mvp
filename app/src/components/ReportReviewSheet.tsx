// Câblage MVP — Feuille de signalement d'avis (Feature 17).
// Modal bas de page : 4 motifs (Faux-Pas du glossaire PRD), un tap = envoi.
// La file arrive dans spawt-admin (page Signalements, table review_reports).

import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import { reportReview } from "../lib/data-source";
import { track } from "../lib/analytics";

type ReasonCode = "fake_review" | "hater" | "gatekeeping" | "autre";

const REASONS: readonly ReasonCode[] = [
  "fake_review",
  "hater",
  "gatekeeping",
  "autre",
];

interface Props {
  visible: boolean;
  /** spawt_checkin.id de l'avis signalé. */
  review_id: string;
  onClose: () => void;
}

export function ReportReviewSheet({ visible, review_id, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const spawter = useSpawterStore((s) => s.spawter);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const close = () => {
    setFeedback(null);
    setSending(false);
    onClose();
  };

  const submit = async (reason: ReasonCode) => {
    if (!spawter || sending) return;
    setSending(true);
    const result = await reportReview({
      spawt_checkin_id: review_id,
      reporter_spawter_id: spawter.id,
      reason_code: reason,
    });
    track({
      name: "review_reported",
      properties: { review_id, reason_code: reason, result },
    });
    setFeedback(
      result === "ok"
        ? t("report.success")
        : result === "duplicate"
        ? t("report.duplicate")
        : t("report.error"),
    );
    setSending(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay.scrim,
          justifyContent: "flex-end",
        }}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t("report.cancel")}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.surface.base,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {feedback === null ? (
            <>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                }}
              >
                {t("report.title")}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("report.subtitle")}
              </Text>
              {REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  testID={`report-reason-${reason}`}
                  accessibilityRole="button"
                  disabled={sending}
                  onPress={() => void submit(reason)}
                  style={({ pressed }) => ({
                    paddingVertical: theme.spacing.base,
                    paddingHorizontal: theme.spacing.base,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border.subtle,
                    opacity: pressed || sending ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      ...theme.typography.preset.body,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {t(`report.reason_${reason}`)}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={{ paddingVertical: theme.spacing.base }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.secondary,
                    textAlign: "center",
                  }}
                >
                  {t("report.cancel")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.primary,
                  textAlign: "center",
                  paddingVertical: theme.spacing.base,
                }}
                testID="report-feedback"
              >
                {feedback}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={{
                  backgroundColor: theme.colors.brand.primary,
                  paddingVertical: theme.spacing.base,
                  borderRadius: theme.radius.md,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.onBrand,
                    textAlign: "center",
                  }}
                >
                  {t("common.ok", { defaultValue: "OK" })}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
