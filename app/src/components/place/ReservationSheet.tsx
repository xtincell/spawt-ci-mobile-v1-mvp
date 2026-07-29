// Réservation 1-tap (migration 0042) — bottom sheet : taille du groupe
// (stepper 1-20, bornes du CHECK DB) + créneau optionnel (DateTimePicker
// natif ; date puis heure sur Android, datetime inline sur iOS ; absent sur
// web → le créneau se précise sur WhatsApp). CTA → onConfirm, le parent
// trace la demande (best-effort) puis ouvre WhatsApp pré-rempli.

import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";
import {
  clampPartySize,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
} from "../../lib/reservations";

interface Props {
  visible: boolean;
  placeName: string;
  onConfirm: (partySize: number, slotAt: string | null) => void;
  onClose: () => void;
}

/** Créneau par défaut proposé au picker : ce soir 20 h (ou +1 h si passé). */
function defaultSlot(): Date {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setTime(Date.now() + 3600_000);
  return d;
}

export function ReservationSheet({ visible, placeName, onConfirm, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [partySize, setPartySize] = useState(2);
  const [slot, setSlot] = useState<Date | null>(null);
  // Android : le picker natif s'ouvre en deux temps (date → heure).
  const [pickerStep, setPickerStep] = useState<"none" | "date" | "time">("none");
  const pendingDateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setPartySize(2);
      setSlot(null);
      setPickerStep("none");
    }
  }, [visible]);

  const openPicker = () => {
    // Web : pas d'implémentation native — le créneau se précisera sur
    // WhatsApp (le champ reste « à préciser »).
    if (Platform.OS === "web") return;
    pendingDateRef.current = slot ?? defaultSlot();
    setPickerStep("date");
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed" || !selected) {
      setPickerStep("none");
      return;
    }
    if (Platform.OS === "ios") {
      // iOS datetime inline : chaque tick met à jour le créneau complet.
      setSlot(selected);
      return;
    }
    if (pickerStep === "date") {
      pendingDateRef.current = selected;
      setPickerStep("time");
      return;
    }
    // Android étape heure : fusionne la date en attente + l'heure choisie.
    const base = pendingDateRef.current ?? defaultSlot();
    const merged = new Date(base);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setSlot(merged);
    setPickerStep("none");
  };

  const slotLabel = slot
    ? slot.toLocaleString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : t("resa.slot_unset");

  const bump = (delta: number) => {
    setPartySize((prev) => clampPartySize(prev + delta));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay.modal,
          justifyContent: "flex-end",
        }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: theme.colors.surface.base,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
          }}
        >
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.h2,
                  color: theme.colors.text.primary,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {t("resa.sheet_title", { name: placeName })}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Ico name="close" size={22} />
              </Pressable>
            </View>

            {/* Taille du groupe — stepper borné 1-20 (CHECK DB). */}
            <View style={{ gap: theme.spacing.sm }}>
              <Text
                style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}
              >
                {t("resa.party_label")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                }}
              >
                <StepperButton
                  icon="arrow-down"
                  disabled={partySize <= PARTY_SIZE_MIN}
                  aria={t("resa.party_minus_aria")}
                  testID="resa-party-minus"
                  onPress={() => bump(-1)}
                />
                <Text
                  testID="resa-party-size"
                  style={{
                    ...theme.typography.preset.display,
                    color: theme.colors.text.primary,
                    minWidth: 56,
                    textAlign: "center",
                  }}
                >
                  {partySize}
                </Text>
                <StepperButton
                  icon="arrow-up"
                  disabled={partySize >= PARTY_SIZE_MAX}
                  aria={t("resa.party_plus_aria")}
                  testID="resa-party-plus"
                  onPress={() => bump(1)}
                />
              </View>
            </View>

            {/* Créneau souhaité — optionnel. */}
            <View style={{ gap: theme.spacing.sm }}>
              <Text
                style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}
              >
                {t("resa.slot_label")}
              </Text>
              <Pressable
                onPress={openPicker}
                accessibilityRole="button"
                accessibilityLabel={t("resa.slot_aria")}
                testID="resa-slot-field"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: theme.colors.border.subtle,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.base,
                  minHeight: 48,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: slot ? theme.colors.text.primary : theme.colors.text.tertiary,
                  }}
                >
                  {slotLabel}
                </Text>
                <Ico name="clock" size={18} color={theme.colors.text.tertiary} />
              </Pressable>
              <Text
                style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}
              >
                {t("resa.slot_hint")}
              </Text>
              {pickerStep !== "none" ? (
                <DateTimePicker
                  testID="resa-slot-picker"
                  value={slot ?? defaultSlot()}
                  mode={
                    Platform.OS === "ios"
                      ? "datetime"
                      : pickerStep === "date"
                        ? "date"
                        : "time"
                  }
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={onPickerChange}
                />
              ) : null}
            </View>

            {/* CTA — ouvre WhatsApp pré-rempli (le parent trace d'abord). */}
            <Pressable
              onPress={() => onConfirm(partySize, slot ? slot.toISOString() : null)}
              accessibilityRole="button"
              accessibilityLabel={t("resa.cta")}
              testID="resa-confirm"
              style={({ pressed }) => ({
                backgroundColor: theme.colors.brand.primary,
                paddingVertical: theme.spacing.base,
                borderRadius: theme.radius.full,
                alignItems: "center",
                minHeight: 48,
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.onBrand }}>
                {t("resa.cta")}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function StepperButton({
  icon,
  disabled,
  aria,
  testID,
  onPress,
}: {
  icon: "arrow-up" | "arrow-down";
  disabled: boolean;
  aria: string;
  testID: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={aria}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.border.subtle : theme.colors.border.strong,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ico
        name={icon}
        size={20}
        color={disabled ? theme.colors.text.tertiary : theme.colors.text.primary}
      />
    </Pressable>
  );
}
