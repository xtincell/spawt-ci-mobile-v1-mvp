// Refonte fiche lieu (R17 + R19) — <PlaceTabs /> segmented control.
// Couvre : rendu des onglets, état a11y selected, onChange sur tap d'un
// onglet inactif, PAS de onChange sur re-tap de l'onglet actif (contrat
// analytics : `place_tab_viewed` uniquement sur vrai changement).

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

import { ThemeProvider } from "../../../theme/ThemeProvider";
import { PlaceTabs } from "../PlaceTabs";

interface NodeLike {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: {
    findAllByType: (t: unknown) => NodeLike[];
    findAll: (p: (n: NodeLike) => boolean) => NodeLike[];
  };
}

type TabKey = "media" | "menu" | "avis";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "media", label: "Média" },
  { key: "menu", label: "Menu" },
  { key: "avis", label: "Avis" },
];

function render(active: TabKey, onChange: (k: TabKey) => void): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <PlaceTabs<TabKey> tabs={TABS} active={active} onChange={onChange} />
      </ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

// Prédicat onPress + role : ne matche que le Pressable composite (le host
// View sous-jacent porte le role mais pas de prop onPress) — même pattern
// que PlaceReviews.test.tsx.
function tabNodes(r: RendererLike): NodeLike[] {
  return r.root.findAll(
    (n) =>
      n.props.accessibilityRole === "tab" &&
      typeof n.props.onPress === "function",
  );
}

describe("<PlaceTabs /> — R17 segmented control", () => {
  it("rend un onglet par item, avec son label", () => {
    const r = render("media", jest.fn());
    const tabs = tabNodes(r);
    expect(tabs).toHaveLength(3);
    expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual([
      "Média",
      "Menu",
      "Avis",
    ]);
    const texts = r.root
      .findAllByType(Text)
      .map((n) => n.props.children)
      .filter((c): c is string => typeof c === "string");
    expect(texts).toContain("Média");
    expect(texts).toContain("Menu");
    expect(texts).toContain("Avis");
  });

  it("expose accessibilityState.selected sur l'onglet actif uniquement", () => {
    const r = render("menu", jest.fn());
    const selected = tabNodes(r).map(
      (n) => (n.props.accessibilityState as { selected: boolean }).selected,
    );
    expect(selected).toEqual([false, true, false]);
  });

  it("déclenche onChange avec la clé au tap d'un onglet inactif", () => {
    const onChange = jest.fn();
    const r = render("media", onChange);
    const avis = tabNodes(r)[2]!;
    TestRenderer.act(() => {
      (avis.props.onPress as () => void)();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("avis");
  });

  it("ne déclenche PAS onChange au re-tap de l'onglet actif", () => {
    const onChange = jest.fn();
    const r = render("media", onChange);
    const media = tabNodes(r)[0]!;
    TestRenderer.act(() => {
      (media.props.onPress as () => void)();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rend un conteneur tablist (a11y)", () => {
    const r = render("media", jest.fn());
    const tablists = r.root.findAll(
      (n) => n.props.accessibilityRole === "tablist",
    );
    expect(tablists.length).toBeGreaterThanOrEqual(1);
  });
});
