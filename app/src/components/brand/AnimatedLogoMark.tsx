// AnimatedLogoMark — le logo PRIMAIRE (pin carte, S de routes) VECTORISÉ et
// animé pour l'ouverture de l'app (R15). Séquence : le pin se trace → la
// carte apparaît → la route en S se dessine → le soleil d'or éclot → les
// 3 étoiles scintillent. react-native-svg + Animated (aucune dépendance
// nouvelle, rend à l'identique en natif et web).
//
// NB design system : la règle « plus de vectoriel » ne vise que la MASCOTTE
// Moka (PNG only) — le logo carte ne contient pas le chat, sa vectorisation
// est légitime (et demandée pour animer l'ouverture).

import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { palette } from "../../theme/tokens";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

// Longueurs de tracé (surestimées volontairement : l'interpolation atterrit
// exactement à 0, le tracé est donc toujours complet en fin d'animation).
const PIN_LEN = 720;
const ROAD_LEN = 560;

interface Props {
  /** Côté du carré rendu, en px. */
  size?: number;
  /** Délai avant le départ de la séquence (ms). */
  delayMs?: number;
  /** Callback à la fin de la séquence (~1,6 s + délai). */
  onDone?: () => void;
  testID?: string;
}

export function AnimatedLogoMark({ size = 200, delayMs = 0, onDone, testID }: Props) {
  const pinDraw = useRef(new Animated.Value(0)).current;
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const roadDraw = useRef(new Animated.Value(0)).current;
  const sunScale = useRef(new Animated.Value(0)).current;
  const starOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // useNativeDriver false : les props SVG (strokeDashoffset, r…) ne sont
    // pas animables par le driver natif — JS driver assumé (séquence courte).
    const sequence = Animated.sequence([
      Animated.delay(delayMs),
      // 1. Le contour du pin se trace.
      Animated.timing(pinDraw, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      // 2. Le fond carte transparaît pendant que la route en S se dessine.
      Animated.parallel([
        Animated.timing(mapOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(roadDraw, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      // 3. Le soleil d'or éclot (léger rebond).
      Animated.timing(sunScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.back(1.6),
        useNativeDriver: false,
      }),
      // 4. Les étoiles scintillent en cascade.
      Animated.stagger(
        90,
        starOpacities.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: false }),
        ),
      ),
    ]);
    sequence.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => sequence.stop();
  }, [delayMs, mapOpacity, onDone, pinDraw, roadDraw, starOpacities, sunScale]);

  const pinDashoffset = pinDraw.interpolate({ inputRange: [0, 1], outputRange: [PIN_LEN, 0] });
  const roadDashoffset = roadDraw.interpolate({ inputRange: [0, 1], outputRange: [ROAD_LEN, 0] });
  const sunR = sunScale.interpolate({ inputRange: [0, 1], outputRange: [0.01, 24] });

  return (
    <View style={{ width: size, height: size }} testID={testID ?? "animated-logo-mark"}>
      <Svg width={size} height={size} viewBox="0 0 200 220">
        {/* Étoiles (or) au-dessus du pin — petite · grande · petite. */}
        {[
          { cx: 62, cy: 22, s: 0.62 },
          { cx: 100, cy: 12, s: 0.95 },
          { cx: 138, cy: 22, s: 0.62 },
        ].map((st, i) => {
          const opacity = starOpacities[i];
          if (!opacity) return null;
          return (
            <AnimatedG
              key={i}
              opacity={opacity}
              transform={`translate(${st.cx}, ${st.cy}) scale(${st.s})`}
            >
              <Path
                d="M0 -11 L3.2 -3.6 L11 -3.2 L5 2 L6.8 10 L0 5.6 L-6.8 10 L-5 2 L-11 -3.2 L-3.2 -3.6 Z"
                fill={palette.gold}
              />
            </AnimatedG>
          );
        })}

        {/* Fond carte (crème) + routes fines — masqués par l'emprise du pin
            (le clip exact est cosmétique : le fond reste dans la goutte). */}
        <AnimatedG opacity={mapOpacity}>
          <Path
            d="M100 208 C100 208 34 136 34 92 A66 66 0 1 1 166 92 C166 136 100 208 100 208 Z"
            fill={palette.cremeSable}
          />
          <Path
            d="M42 78 L92 52 M120 44 L158 74 M52 118 L88 96 M118 128 L152 104"
            stroke={palette.grisMoyen}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.55}
            fill="none"
          />
        </AnimatedG>

        {/* La route en S (charbon) qui se dessine. */}
        <AnimatedPath
          d="M146 58 C96 44 48 74 56 100 C64 126 136 118 146 142 C154 162 116 182 102 196"
          stroke={palette.black}
          strokeWidth={24}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${ROAD_LEN}`}
          strokeDashoffset={roadDashoffset}
        />

        {/* Le soleil d'or (éclot après la route). */}
        <AnimatedCircle cx={134} cy={64} r={sunR} fill={palette.gold} />

        {/* Le contour du pin qui se trace (par-dessus tout). Blanc cassé :
            le splash est sur fond gr-night — un contour charbon (fidèle au
            logo sur fond clair) serait invisible pendant le tracé. */}
        <AnimatedPath
          d="M100 208 C100 208 34 136 34 92 A66 66 0 1 1 166 92 C166 136 100 208 100 208 Z"
          stroke={palette.blancCasse}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${PIN_LEN}`}
          strokeDashoffset={pinDashoffset}
        />
      </Svg>
    </View>
  );
}
