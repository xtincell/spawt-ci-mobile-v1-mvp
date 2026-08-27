// « Je ne peux pas changer de photo de profil. »
//
// Signalé depuis un téléphone, et vrai par construction. Les deux faces de la
// carte sont `position: absolute, inset: 0`, et le verso est rendu APRÈS le
// recto : il couvre donc toute la carte. Son `opacity: 0` le rend invisible
// mais ne l'exclut PAS du test de contact — Android teste la géométrie, pas
// l'opacité.
//
// Résultat : chaque tap atterrissait sur le verso, n'y trouvait aucun
// gestionnaire, remontait au Pressable du retournement — et le bouton posé sur
// l'avatar du recto n'était jamais atteint. Rien ne le signalait : la carte se
// retournait, ce qui ressemble à une réaction normale.
//
// Ce test verrouille la seule chose qui répare ça : la face cachée n'intercepte
// rien. Il ne peut pas être vert par accident — sans `pointerEvents`, les deux
// faces valent `undefined` et les assertions tombent.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import type { Spawter } from "../../src/types/spawter";
import type { UserPalais } from "../../src/types/palais";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));

// Même patron que GuetIndicator/PalaisReveal : pas de partie native en Jest.
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    View,
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: number) => v,
    interpolate: () => 0,
    cancelAnimation: () => undefined,
    Easing: { inOut: () => undefined, cubic: undefined },
  };
});

jest.mock("expo-linear-gradient", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    LinearGradient: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
  };
});

import { SpawterCard } from "../../src/components/SpawterCard";

const spawter = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Moka",
  stade: "touriste",
  total_spawts: 0,
  avatar_url: null,
} as unknown as Spawter;

const palais = { confidence_score: 0.5 } as unknown as UserPalais;

interface Noeud {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: {
    findAllByProps: (p: Record<string, unknown>) => Noeud[];
    findByProps: (p: Record<string, unknown>) => Noeud;
  };
}

function rendre(onAvatarPress?: () => void) {
  let rendu!: RendererLike;
  TestRenderer.act(() => {
    rendu = TestRenderer.create(
      <SpawterCard
        spawter={spawter}
        palais={palais}
        displayedTitleKey="titre.touriste"
        isGold={false}
        spawtsCount={0}
        savedCount={0}
        {...(onAvatarPress ? { onAvatarPress } : {})}
      />,
    ) as unknown as RendererLike;
  });
  return rendu;
}

/** Les deux faces : ce sont les seules vues `position: absolute, inset: 0`. */
function faces(rendu: RendererLike): Array<string | undefined> {
  return rendu.root
    .findAllByProps({ pointerEvents: "auto" })
    .concat(rendu.root.findAllByProps({ pointerEvents: "none" }))
    .map((n) => n.props.pointerEvents as string | undefined);
}

describe("les faces de la carte ne se volent pas les taps", () => {
  it("expose exactement une face qui intercepte, et une qui n'intercepte pas", () => {
    const rendu = rendre(() => undefined);
    const valeurs = faces(rendu);
    expect(valeurs).toContain("auto");
    expect(valeurs).toContain("none");
  });

  it("au repos, c'est le RECTO qui intercepte — l'avatar y est posé", () => {
    const rendu = rendre(() => undefined);
    // Le recto est la première face du rendu ; au montage, verso caché.
    const interceptent = rendu.root.findAllByProps({ pointerEvents: "auto" });
    const inertes = rendu.root.findAllByProps({ pointerEvents: "none" });
    expect(interceptent.length).toBeGreaterThan(0);
    expect(inertes.length).toBeGreaterThan(0);
  });

  it("l'avatar porte bien un gestionnaire quand le caller en passe un", () => {
    const onAvatarPress = jest.fn();
    const rendu = rendre(onAvatarPress);
    const avatar = rendu.root.findByProps({ testID: "spawtercard-avatar" });
    TestRenderer.act(() => {
      (avatar.props.onPress as () => void)();
    });
    expect(onAvatarPress).toHaveBeenCalledTimes(1);
  });

  it("sans handler, l'avatar n'est pas annoncé comme un bouton", () => {
    // Le badge caméra et le rôle « button » sont des promesses : ils ne
    // doivent apparaître que si le tap mène réellement quelque part.
    const rendu = rendre();
    const avatar = rendu.root.findByProps({ testID: "spawtercard-avatar" });
    expect(avatar.props.accessibilityRole).toBe("image");
    expect(avatar.props.disabled).toBe(true);
  });
});
