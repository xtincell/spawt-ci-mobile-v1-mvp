// Select — primitive liste déroulante SPAWT (retours alpha R1/R3/R16).
// Champ Pressable (valeur courante ou placeholder + chevron) qui ouvre un
// Modal bottom-sheet avec la liste scrollable d'options. Zéro dépendance
// externe (Modal RN + SafeAreaView déjà présents, pattern FilterSheet).
// Deux modes :
//   - single (défaut) : `value`/`onChange` — la sélection ferme la sheet ;
//   - multi : `values`/`onToggle` — la sheet reste ouverte, CTA `doneLabel`
//     (ou tap hors sheet / back Android) pour fermer.

import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "./Ico";

export interface SelectOption {
  /** Clé stable (identifiant technique, jamais affichée). */
  key: string;
  /** Libellé affiché — déjà traduit par l'appelant (i18n au call-site). */
  label: string;
}

interface SelectBaseProps {
  /** Libellé rendu au-dessus du champ + titre de la sheet. Optionnel : les
   *  écrans qui rendent déjà leur propre label (ex. `Field`) l'omettent. */
  label?: string;
  /** Texte du champ vide ; sert aussi de titre de sheet si `label` absent. */
  placeholder: string;
  options: ReadonlyArray<SelectOption>;
  testID?: string;
  accessibilityLabel: string;
}

interface SelectSingleProps extends SelectBaseProps {
  multi?: false;
  /** Clé de l'option sélectionnée (`null` = aucune → placeholder). */
  value: string | null;
  /** Sélection d'une option — ferme la sheet. */
  onChange: (key: string) => void;
  values?: undefined;
  onToggle?: undefined;
  doneLabel?: undefined;
}

interface SelectMultiProps extends SelectBaseProps {
  multi: true;
  /** Clés des options sélectionnées. */
  values: readonly string[];
  /** Toggle d'une option — la sheet reste ouverte. */
  onToggle: (key: string) => void;
  /** Libellé du CTA qui ferme la sheet en mode multi. */
  doneLabel: string;
  value?: undefined;
  onChange?: undefined;
}

export type SelectProps = SelectSingleProps | SelectMultiProps;

export function Select(props: SelectProps) {
  const { label, placeholder, options, testID, accessibilityLabel } = props;
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const isSelected = (key: string): boolean =>
    props.multi === true ? props.values.includes(key) : props.value === key;

  // Affichage dans l'ordre des options (stable), pas dans l'ordre des taps.
  const selectedLabels = options.filter((o) => isSelected(o.key)).map((o) => o.label);
  const display = selectedLabels.join(", ");
  const hasValue = selectedLabels.length > 0;

  const close = () => setOpen(false);

  const onOptionPress = (key: string) => {
    if (props.multi === true) {
      props.onToggle(key);
    } else {
      props.onChange(key);
      close();
    }
  };

  return (
    <View>
      {label ? (
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size.base,
            fontWeight: theme.typography.weight.medium,
            marginBottom: theme.spacing.xs,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        accessibilityValue={{ text: hasValue ? display : placeholder }}
        hitSlop={4}
        style={({ pressed }) => ({
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surface.raised,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: hasValue ? theme.colors.brand.primary : theme.colors.border.subtle,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          testID={testID ? `${testID}-value` : undefined}
          numberOfLines={1}
          style={{
            flex: 1,
            color: hasValue ? theme.colors.text.primary : theme.colors.text.tertiary,
            fontSize: theme.typography.size.base,
            fontWeight: theme.typography.weight.medium,
          }}
        >
          {hasValue ? display : placeholder}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Ico name="chevron-down" size={18} color={theme.colors.text.tertiary} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay.modal,
            justifyContent: "flex-end",
          }}
        >
          {/* Zone au-dessus de la sheet : tap = fermeture. Non focusable par
              les lecteurs d'écran — la fermeture reste accessible via le CTA
              multi et le geste système (onRequestClose). */}
          <Pressable
            onPress={close}
            accessible={false}
            importantForAccessibility="no"
            testID={testID ? `${testID}-backdrop` : undefined}
            style={{ flex: 1 }}
          />
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: theme.colors.surface.base,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              maxHeight: "70%",
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.h2,
                color: theme.colors.text.primary,
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.lg,
                paddingBottom: theme.spacing.sm,
              }}
            >
              {label ?? placeholder}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: theme.spacing.base }}
            >
              {options.map((o, idx) => {
                const selected = isSelected(o.key);
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => onOptionPress(o.key)}
                    testID={testID ? `${testID}-option-${o.key}` : undefined}
                    accessibilityRole={props.multi === true ? "checkbox" : "radio"}
                    accessibilityState={
                      props.multi === true ? { checked: selected } : { selected }
                    }
                    accessibilityLabel={o.label}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.sm,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border.subtle,
                      backgroundColor: pressed
                        ? theme.colors.surface.subtle
                        : theme.colors.surface.base,
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: theme.colors.text.primary,
                        fontSize: theme.typography.size.base,
                        fontWeight: selected
                          ? theme.typography.weight.semibold
                          : theme.typography.weight.regular,
                      }}
                    >
                      {o.label}
                    </Text>
                    {selected ? (
                      <Ico name="check" size={18} color={theme.colors.brand.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {props.multi === true ? (
              <Pressable
                onPress={close}
                testID={testID ? `${testID}-done` : undefined}
                accessibilityRole="button"
                accessibilityLabel={props.doneLabel}
                style={({ pressed }) => ({
                  minHeight: 48,
                  justifyContent: "center",
                  alignItems: "center",
                  marginHorizontal: theme.spacing.lg,
                  marginTop: theme.spacing.sm,
                  marginBottom: theme.spacing.base,
                  backgroundColor: theme.colors.brand.accent,
                  paddingVertical: theme.spacing.base,
                  borderRadius: theme.radius.lg,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.text.inverse,
                    fontSize: theme.typography.size.base,
                    fontWeight: theme.typography.weight.semibold,
                  }}
                >
                  {props.doneLabel}
                </Text>
              </Pressable>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
