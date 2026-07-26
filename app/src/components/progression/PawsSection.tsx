// Progression — section Paws : solde (icône patte) + historique lisible du
// ledger append-only (0035). Rappel D2/0014 : les paws sont une reconnaissance
// d'engagement, JAMAIS convertibles, jamais un portefeuille.

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";
import type { PawsLedgerEntry } from "../../types/progression";

interface Props {
  balance: number | null;
  ledger: readonly PawsLedgerEntry[];
}

export function PawsSection({ balance, ledger }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View testID="progression-paws-section" style={{ gap: theme.spacing.base }}>
      <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>
        {t("progression.paws_title")}
      </Text>

      {/* Solde — patte or + chiffre héro. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.base,
          padding: theme.spacing.base,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface.subtle,
        }}
      >
        <Ico name="paw" size={32} color={theme.colors.brand.primary} filled />
        <View>
          <Text
            testID="paws-balance"
            style={{ ...theme.typography.preset.display, color: theme.colors.text.primary }}
          >
            {balance ?? "—"}
          </Text>
          <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}>
            {t("progression.paws_balance_label")}
          </Text>
        </View>
      </View>
      <Text
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.tertiary,
          fontStyle: "italic",
        }}
      >
        {t("progression.paws_hint")}
      </Text>

      {/* Historique du ledger — chaque ligne raconte un geste. */}
      {ledger.length === 0 ? (
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
          {t("progression.paws_empty")}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {ledger.map((entry) => (
            <View
              key={entry.id}
              testID={`paws-entry-${entry.id}`}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.subtle,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
                  {t(`progression.paws_reason.${entry.reason}`)}
                </Text>
                <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}>
                  {formatDateFr(entry.created_at)}
                </Text>
              </View>
              <Text
                style={{
                  ...theme.typography.preset.data,
                  color:
                    entry.delta >= 0
                      ? theme.colors.state.success
                      : theme.colors.state.danger,
                }}
              >
                {entry.delta >= 0 ? `+${entry.delta}` : `${entry.delta}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Date courte fr — tolérante aux strings invalides. */
function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
