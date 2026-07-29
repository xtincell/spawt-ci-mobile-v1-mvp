// Story 2.1 — AC #4 (primitive)
// Régression : Story 1.3 a livré CatBubble avec `variant` + `stage` en stubs
// (console.warn). Story 2.1 ferme les variants `lockscreen` et `edito`. Ce test
// garantit qu'il n'y a plus de warn ET que les 3 variants rendent des styles
// visiblement distincts.

import { Text } from "react-native";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only; types non-installés (jest internal use)
import TestRenderer from "react-test-renderer";

import { CatBubble, type CatBubbleVariant } from "../../src/components/primitives/CatBubble";

type ReactTestRendererJSON = {
  type: string;
  props: { style?: unknown; [key: string]: unknown };
  children: ReactTestRendererJSON[] | null;
};

function renderVariant(variant: CatBubbleVariant): ReactTestRendererJSON | ReactTestRendererJSON[] | null {
  let instance: { toJSON: () => ReactTestRendererJSON | ReactTestRendererJSON[] | null } | null = null;
  TestRenderer.act(() => {
    instance = TestRenderer.create(
      <CatBubble variant={variant}>
        <Text>test</Text>
      </CatBubble>,
    );
  });
  if (!instance) throw new Error("renderer did not initialize");
  return (instance as { toJSON: () => ReactTestRendererJSON | ReactTestRendererJSON[] | null }).toJSON();
}

function getRootStyle(tree: ReactTestRendererJSON | ReactTestRendererJSON[] | null) {
  // Si plusieurs roots (cas de réutilisation interne RN), on prend le premier
  // qui a un `style` défini.
  if (!tree) throw new Error("tree is null");
  let node: ReactTestRendererJSON | undefined;
  if (Array.isArray(tree)) {
    node = tree.find((n) => n.props?.style) ?? tree[0];
  } else {
    node = tree;
  }
  if (!node) throw new Error("no node with style");
  return node.props.style as Record<string, unknown> | Record<string, unknown>[];
}

describe("CatBubble — 3 variants (Story 2.1)", () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

  afterAll(() => {
    warnSpy.mockRestore();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  it("variant `bubble` (défaut) rend sans warn", () => {
    const tree = renderVariant("bubble");
    expect(tree).toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("variant `lockscreen` rend sans warn (régression vs stub Story 1.3)", () => {
    const tree = renderVariant("lockscreen");
    expect(tree).toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("variant `edito` rend sans warn (régression vs stub Story 1.3)", () => {
    const tree = renderVariant("edito");
    expect(tree).toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("variant `bubble` utilise un coin asymétrique 16/16/16/4", () => {
    const tree = renderVariant("bubble");
    const style = getRootStyle(tree) as Record<string, unknown>;
    expect(style.borderTopLeftRadius).toBe(16);
    expect(style.borderTopRightRadius).toBe(16);
    expect(style.borderBottomLeftRadius).toBe(16);
    expect(style.borderBottomRightRadius).toBe(4);
  });

  it("variant `lockscreen` utilise un coin uniforme + flexDirection row + alignItems flex-start", () => {
    const tree = renderVariant("lockscreen");
    const style = getRootStyle(tree) as Record<string, unknown>;
    expect(style.borderRadius).toBe(12);
    expect(style.flexDirection).toBe("row");
    expect(style.alignItems).toBe("flex-start");
    // Pas de coin asymétrique
    expect(style.borderTopLeftRadius).toBeUndefined();
  });

  it("variant `edito` utilise un layout column + marginVertical (pavé éditorial)", () => {
    const tree = renderVariant("edito");
    const style = getRootStyle(tree) as Record<string, unknown>;
    expect(style.flexDirection).toBe("column");
    expect(style.marginVertical).toBeGreaterThan(0);
    // Pas de coin asymétrique
    expect(style.borderTopRightRadius).toBeUndefined();
  });

  it("les 3 variants produisent des styles distincts (au moins une prop différente)", () => {
    const bubbleStyle = JSON.stringify(getRootStyle(renderVariant("bubble")));
    const lockStyle = JSON.stringify(getRootStyle(renderVariant("lockscreen")));
    const editoStyle = JSON.stringify(getRootStyle(renderVariant("edito")));
    expect(bubbleStyle).not.toBe(lockStyle);
    expect(bubbleStyle).not.toBe(editoStyle);
    expect(lockStyle).not.toBe(editoStyle);
  });
});
