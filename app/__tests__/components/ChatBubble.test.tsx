// Story 2.1 — AC #3 (réactivité stade-up)
// Démontre qu'un changement de prop `stade` sur <ChatBubble> :
//   (1) requête la nouvelle clé i18n via t() — `chat.<stade>.<moment>`
//   (2) propage le nouveau `stage` à la primitive <CatBubble> enfant.
//
// Sur le terrain, ce changement de prop est déclenché par le re-render Zustand :
// quand `registerSpawt` mute `spawter.stade` dans le store, le sélecteur
// `useSpawterStore((s) => s.spawter)` re-rend le caller ((tabs)/index.tsx ou
// profile.tsx), qui passe la nouvelle valeur en prop à <ChatBubble>. Le test
// ici simule cette propagation au niveau du composite domain.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only; types non-installés
import TestRenderer from "react-test-renderer";

// Variable préfixée `mock*` pour respecter la règle Jest sur les factories de mock.
const mockTranslate = jest.fn((key: string) => `[${key}]`);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

// Imports APRÈS jest.mock — sinon ChatBubble résoudrait le vrai useTranslation.
import { ChatBubble } from "../../src/components/ChatBubble";
import { CatBubble } from "../../src/components/primitives/CatBubble";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: { findByType: (t: unknown) => TestInstanceLike };
  update: (el: ReactNode) => void;
}

describe("ChatBubble — réactivité stade-up (AC #3)", () => {
  afterEach(() => {
    mockTranslate.mockClear();
  });

  function createInstance(element: ReactNode): TestRendererInstanceLike {
    let raw: TestRendererInstanceLike | null = null;
    TestRenderer.act(() => {
      raw = TestRenderer.create(element) as unknown as TestRendererInstanceLike;
    });
    if (!raw) throw new Error("renderer did not initialize");
    return raw;
  }

  it("change stade prop → t() requête nouvelle clé i18n ET CatBubble.stage propage", () => {
    const instance = createInstance(<ChatBubble stade="touriste" moment="welcome_back" />);

    // (1) clé i18n initiale = chat.touriste.welcome_back
    expect(mockTranslate).toHaveBeenCalledWith("chat.touriste.welcome_back");
    // (2) CatBubble enfant reçoit stage="touriste"
    expect(instance.root.findByType(CatBubble).props.stage).toBe("touriste");

    mockTranslate.mockClear();

    // Simulation d'une montée de stade : prop `stade` change (Touriste → Explorateur).
    // Le caller Zustand re-rend ; ici on simule via TestRenderer.update.
    TestRenderer.act(() => {
      instance.update(<ChatBubble stade="explorateur" moment="welcome_back" />);
    });

    // (1) nouvelle clé i18n = chat.explorateur.welcome_back
    expect(mockTranslate).toHaveBeenCalledWith("chat.explorateur.welcome_back");
    // (2) CatBubble enfant reçoit stage="explorateur"
    expect(instance.root.findByType(CatBubble).props.stage).toBe("explorateur");
  });

  it("re-render avec même stade mais nouveau moment requête une clé différente", () => {
    const instance = createInstance(<ChatBubble stade="touriste" moment="welcome_first_open" />);

    expect(mockTranslate).toHaveBeenCalledWith("chat.touriste.welcome_first_open");

    mockTranslate.mockClear();
    TestRenderer.act(() => {
      instance.update(<ChatBubble stade="touriste" moment="post_calibration" />);
    });

    expect(mockTranslate).toHaveBeenCalledWith("chat.touriste.post_calibration");
  });
});
