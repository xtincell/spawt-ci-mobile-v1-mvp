import { useCallback, useEffect, useId, useRef } from "react";
import { Platform, useWindowDimensions } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, FeGaussianBlur, Filter, G, Path, Rect, type GProps } from "react-native-svg";
import Reanimated, { cancelAnimation, Easing, runOnJS, useAnimatedProps, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import suppliedPaths from "../../../assets/brand/window-opening.paths.json";
import { HEAD, PIN, TORSO } from "./window-opening-art";
import { ease, phase, poseMatrix, smooth, WINDOW_POSE_MS, windowWink } from "./window-opening-motion";
import { openingWindowColors, palette } from "../../theme/tokens";

const AnimatedG = Reanimated.createAnimatedComponent(G);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);
const AnimatedEllipse = Reanimated.createAnimatedComponent(Ellipse);
const NATIVE = Platform.OS !== "web";
type MotionProps = GProps & { matrix?: number[] };
type Shape = { tag: string; fill: string; d?: string; cx?: number; cy?: number; r?: number; bbox?: { x: number; y: number; w: number; h: number } };
const paths = suppliedPaths as Record<string, Shape>;
const mapIds = [...Array.from({ length: 15 }, (_, i) => i + 22), 40, 41];
const excludedHead = new Set([43, 44, 55, 56, 57, 59, 60, 64, 65, 66, 67, 68, 69, 71, 72]);
const headIds = Array.from({ length: 31 }, (_, i) => i + 42).filter(i => !excludedHead.has(i));
const collarIds = [64, 65, 66, 67, 68, 69, 71, 72];

function shape(id: number) {
  const p = paths[id]!;
  return p.tag === "circle"
    ? <Circle key={id} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
    : <Path key={id} d={p.d!} fill={p.fill} />;
}
function transform(matrix: number[]): Pick<MotionProps, "matrix" | "transform"> {
  "worklet";
  // Fabric attend sa matrice native ; le DOM attend l’attribut SVG transform.
  return NATIVE ? { matrix } : { transform: `matrix(${matrix.join(" ")})` };
}
function Star({ id, start, clock }: { id: number; start: number; clock: SharedValue<number> }) {
  const path = paths[id]!, box = path.bbox!, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const props = useAnimatedProps<MotionProps>(() => {
    const u = phase(clock.value, start, start + .3);
    const z = u >= 1 ? 1 : 1 + 2.1 * (u - 1) ** 3 + 1.1 * (u - 1) ** 2;
    return transform([z, 0, 0, z, cx * (1 - z), cy * (1 - z) - 79 - 8 * Math.sin(Math.PI * u)]);
  });
  const inkProps = useAnimatedProps(() => ({ opacity: Math.min(1, phase(clock.value, start, start + .3) * 5) }));
  return <AnimatedG animatedProps={props}><AnimatedPath d={path.d!} fill={path.fill} animatedProps={inkProps} /></AnimatedG>;
}

interface Props { animate: boolean; staticPose?: boolean; onDone: () => void }

/** Tracés et masques du pack V2 ; mouvements exécutés sur le thread UI natif. */
export function WindowOpeningMark({ animate, staticPose = false, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const clock = useSharedValue(staticPose ? 1.14 : 0);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const done = useCallback(() => onDoneRef.current(), []);
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const headClip = `${prefix}Head`, aperture = `${prefix}Aperture`, portal = `${prefix}Portal`, rim = `${prefix}Rim`, soft = `${prefix}Soft`;
  useEffect(() => {
    cancelAnimation(clock);
    if (staticPose) { clock.value = 1.14; return; }
    clock.value = 0;
    if (animate) clock.value = withTiming(1.14, { duration: WINDOW_POSE_MS, easing: Easing.linear }, finished => {
      if (finished) runOnJS(done)();
    });
    return () => cancelAnimation(clock);
  }, [animate, staticPose, clock, done]);

  // Android SVG conserve un Canvas de groupe pour opacity, puis le réutilise
  // incorrectement lorsque la valeur traverse 1 (crash Canvas.restore).
  // Les groupes gardent opacity=1 ; seuls les tracés portent les fondus.
  // La pose initiale place déjà tout le personnage hors des deux masques.
  const characterProps = useAnimatedProps<MotionProps>(() => transform(poseMatrix(clock.value)));
  const shadowProps = useAnimatedProps(() => ({ opacity: .16 * ease(clock.value, .14, .36) }));
  const winkCoverProps = useAnimatedProps(() => ({ opacity: windowWink(clock.value) > 0 ? 1 : 0 }));
  const eyeProps = useAnimatedProps<MotionProps>(() => {
    const wink = windowWink(clock.value);
    const sy = 1 - .97 * wink;
    return transform([1, 0, 0, sy, 0, 201 * (1 - sy)]);
  });
  const eyeInkProps = useAnimatedProps(() => {
    const wink = windowWink(clock.value);
    return { opacity: wink > 0 ? 1 - smooth(phase(wink, .4, 1)) : 0 };
  });
  const lidProps = useAnimatedProps(() => ({ opacity: smooth(phase(windowWink(clock.value), .4, 1)) }));
  // Même taille physique que le raccord PNG, sans agrandir le logo sur les petits écrans.
  const logicalHeight = 360 * height / width, s = .49 * 360 / width;
  // Le splash Android centre le contour dans son masque circulaire. iOS et
  // web conservent la composition portrait du PNG fourni.
  const centerY = Platform.OS === "android" ? 241.5 : 175;
  return (
    <Svg width={width} height={height} viewBox={`0 0 360 ${logicalHeight}`} testID="spawt-window-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={headClip}><Path d={HEAD} /></ClipPath>
        <ClipPath id={aperture}><Path d={PIN} /></ClipPath>
        <ClipPath id={portal}><Path d={PIN} /><Rect x={90} y={-220} width={460} height={405} /></ClipPath>
        <ClipPath id={rim}><Rect x={100} y={181} width={450} height={320} /></ClipPath>
        <Filter id={soft}><FeGaussianBlur stdDeviation={5} /></Filter>
      </Defs>
      <G transform={`translate(${180 - 309 * s} ${logicalHeight / 2 - centerY * s}) scale(${s})`}>
        <Path d={PIN} fill={openingWindowColors.paper} />
        <G clipPath={`url(#${aperture})`}>
          {mapIds.map(shape)}
          <Path d={PIN} fill="none" stroke={openingWindowColors.paperEdge} strokeWidth={7} transform="translate(0 7)" />
        </G>
        <Path d={PIN} fill="none" stroke={palette.graphite} strokeWidth={11} strokeLinejoin="round" />
        <G clipPath={`url(#${aperture})`}>
          <AnimatedEllipse animatedProps={shadowProps} cx={312} cy={226} rx={111} ry={43} fill={palette.graphite} filter={`url(#${soft})`} />
          <AnimatedG animatedProps={characterProps}>
            <Path d={TORSO} fill={palette.pureWhite} stroke={palette.graphite} strokeWidth={7} />
            <Path d="M251 267 C271 282 289 307 280 331 C274 350 260 362 239 365 L216 395 L216 328 Z" fill={palette.graphite} />
            <Path d="M240 365 C274 354 296 378 310 415 L365 551 L265 570 L210 446 Z" fill={palette.gold} />
          </AnimatedG>
        </G>
        <G clipPath={`url(#${portal})`}>
          <AnimatedG animatedProps={characterProps}>
            <Path d={HEAD} fill={palette.graphite} />
            <G clipPath={`url(#${headClip})`}>{headIds.map(shape)}</G>
            <G>
              <AnimatedPath animatedProps={winkCoverProps} d={paths[53]!.d!} fill={palette.graphite} stroke={palette.graphite} strokeWidth={1.3} />
              <AnimatedG animatedProps={eyeProps}><AnimatedPath d={paths[53]!.d!} fill={paths[53]!.fill} animatedProps={eyeInkProps} /></AnimatedG>
              <AnimatedPath animatedProps={lidProps} d="M261 199 Q282 213 302 195" fill="none" stroke={palette.pureWhite} strokeWidth={2.9} strokeLinecap="round" />
            </G>
            {collarIds.map(shape)}
          </AnimatedG>
        </G>
        <Path d={PIN} fill="none" stroke={palette.graphite} strokeWidth={11} strokeLinejoin="round" clipPath={`url(#${rim})`} />
        <Star id={37} start={.39} clock={clock} />
        <Star id={38} start={.44} clock={clock} />
        <Star id={39} start={.49} clock={clock} />
      </G>
    </Svg>
  );
}
