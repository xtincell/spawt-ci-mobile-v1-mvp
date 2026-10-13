import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";

/** Editorial concepts only: no place IDs, published records, ranking or navigation. */
export function EditorialPreview({ duo = false }: { duo?: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const concepts = duo
    ? ["coffee", "table"]
    : ["maquis-braise", "sucre-cocody"];
  return (
    <View
      testID={duo ? "duo-preview" : "collections-preview"}
      style={{
        gap: 16,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: 24,
      }}
    >
      {concepts.map((concept) => (
        <View
          key={concept}
          style={{
            padding: 20,
            gap: 12,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            borderColor: duo
              ? theme.colors.brand.primary
              : theme.colors.surface.inverse,
            backgroundColor: duo
              ? theme.colors.surface.editorial
              : theme.colors.surface.inverse,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
            }}
          >
            {t("home.preview.label")}
          </Text>
          {!duo ? (
            <Ico name="map" size={42} color={theme.colors.brand.primary} />
          ) : null}
          <View
            style={{
              flexDirection: duo && !stacked ? "row" : "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                flex: duo && !stacked ? 1 : undefined,
                width: duo && !stacked ? undefined : "100%",
                gap: 8,
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.h2,
                  color: duo
                    ? theme.colors.text.primary
                    : theme.colors.text.inverse,
                }}
              >
                {t(
                  duo
                    ? `home.preview.${concept}.title`
                    : `explore.${concept}.title`,
                )}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: duo
                    ? theme.colors.text.secondary
                    : theme.colors.text.inverse,
                }}
              >
                {t(
                  duo
                    ? `home.preview.${concept}.body`
                    : `explore.${concept}.subtitle`,
                )}
              </Text>
            </View>
            {duo ? (
              <DuoDrawing
                table={concept === "table"}
                size={stacked ? 156 : 112}
              />
            ) : null}
          </View>
        </View>
      ))}
      <View
        style={{
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
        }}
      >
        <Text
          style={{
            ...theme.typography.preset.caption,
            textTransform: "none",
            letterSpacing: 0,
            fontFamily: theme.typography.family.body,
            color: theme.colors.text.secondary,
          }}
        >
          {t("home.preview.notice")}
        </Text>
      </View>
    </View>
  );
}

function DuoDrawing({ table, size }: { table: boolean; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 180 170"
        fill="none"
        stroke={colors.text.primary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Ellipse
          cx={90}
          cy={149}
          rx={78}
          ry={12}
          fill={colors.surface.subtle}
          stroke="none"
        />
        {table ? (
          <>
            <Path
              d="M21 97V58c0-24 31-24 31 0v43M128 101V58c0-24 31-24 31 0v39"
              fill={colors.brand.primary}
            />
            <Path
              d="m24 55 26 31m-26-17 26 31m-26-3 25-29m-25 13 25-29m82 3 26 31m-26-17 26 31m-26-3 25-29m-25 13 25-29"
              stroke={colors.surface.base}
              strokeWidth={1}
            />
            <Path
              d="m19 103 39-2 5 10-44 1Zm103-2 39 2v9l-44-1Z"
              fill={colors.surface.base}
            />
            <Path d="m23 112-5 39m35-39 7 39m65-39-7 39m39-39 5 39M90 103v45m-18 4 18-4 18 4" />
            <Ellipse
              cx={90}
              cy={99}
              rx={48}
              ry={10}
              fill={colors.surface.base}
            />
            <Path
              d="m84 90-2-18h16l-2 18ZM90 72V43m0 18-11-12m11 5 10-13"
              stroke={colors.brand.primary}
            />
            <Path
              d="M89 44c-10 2-14-4-11-9 8-1 11 4 11 9Zm3-6c-4-8 0-14 6-13 3 7-1 12-6 13Zm1 14c0-9 6-13 12-9-1 7-7 10-12 9Z"
              fill={colors.brand.primary}
              stroke={colors.brand.primary}
            />
          </>
        ) : (
          <>
            {[0, 84].map((offset) => (
              <G key={offset} transform={`translate(${offset} 0)`}>
                <Ellipse
                  cx={47}
                  cy={137}
                  rx={36}
                  ry={8}
                  fill={colors.surface.base}
                />
                <Path d="M72 87c30-8 31 26 3 29m-1-20c15-5 15 11 0 11" />
                <Path
                  d="M17 84c1 30 10 46 29 46s28-16 29-46Z"
                  fill={colors.surface.base}
                />
                <Ellipse
                  cx={46}
                  cy={84}
                  rx={29}
                  ry={7}
                  fill={colors.brand.primary}
                />
                <Path
                  d="M34 63c-15-17 13-19 0-37m20 40c14-15-12-17 1-34"
                  stroke={colors.brand.primary}
                />
              </G>
            ))}
            <Path
              d="M82 19 77 8m16 9V4m10 15 7-10"
              stroke={colors.brand.primary}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
