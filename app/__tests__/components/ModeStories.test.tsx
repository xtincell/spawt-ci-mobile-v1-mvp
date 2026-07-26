// Tests hub des modes — <ModeStories /> (non-régression + entrées Sprint 2).
// Critère de non-régression : sans `entries` (ou entries=[]), le rendu est
// STRICTEMENT identique à l'existant — 4 chips radio, aucune entrée bouton.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ModeStories, type ModeEntry } from "../../src/components/ModeStories";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

interface NodeLike {
  type: unknown;
  props: Record<string, unknown>;
}

/** Éléments HOST only — findAll matche aussi les composites (doublons). */
function isHost(n: NodeLike): boolean {
  return typeof n.type === "string";
}
interface RendererLike {
  root: { findAll: (predicate: (n: NodeLike) => boolean) => NodeLike[] };
}

function render(entries?: readonly ModeEntry[]): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ModeStories
          selectedMode={null}
          onModePress={jest.fn()}
          {...(entries !== undefined ? { entries } : {})}
        />
      </ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function radios(r: RendererLike): NodeLike[] {
  return r.root.findAll(
    (n) => isHost(n) && n.props.accessibilityRole === "radio",
  );
}

function buttons(r: RendererLike): NodeLike[] {
  return r.root.findAll(
    (n) => isHost(n) && n.props.accessibilityRole === "button",
  );
}

describe("<ModeStories /> — non-régression (flags off)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sans entries : 4 chips radio, AUCUNE entrée de navigation", () => {
    const r = render();
    expect(radios(r)).toHaveLength(4);
    expect(buttons(r)).toHaveLength(0);
  });

  it("entries=[] : rendu identique (0 bouton)", () => {
    const r = render([]);
    expect(radios(r)).toHaveLength(4);
    expect(buttons(r)).toHaveLength(0);
  });
});

describe("<ModeStories /> — entrées de modes plein écran (Sprint 2)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rend les entrées AVANT les chips d'humeur, role button + label i18n", () => {
    const onRapide = jest.fn();
    const r = render([
      { key: "rapide", icon: "arrow-right", labelKey: "modes.entry_rapide.label", onPress: onRapide },
      { key: "explore", icon: "map", labelKey: "modes.entry_explore.label", onPress: jest.fn() },
    ]);
    const entryButtons = buttons(r);
    expect(entryButtons).toHaveLength(2);
    expect(entryButtons[0]!.props.accessibilityLabel).toBe("modes.entry_rapide.label");
    // Les 4 chips d'humeur restent intactes à côté des entrées.
    expect(radios(r)).toHaveLength(4);
    // Press via le composite Pressable (le host View ne porte pas onPress).
    const pressables = r.root.findAll(
      (n) =>
        n.props.accessibilityLabel === "modes.entry_rapide.label" &&
        typeof n.props.onPress === "function",
    );
    expect(pressables.length).toBeGreaterThan(0);
    (pressables[0]!.props.onPress as () => void)();
    expect(onRapide).toHaveBeenCalledTimes(1);
  });
});
