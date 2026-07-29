// Story 4.1 — Tests render GuetIndicator via react-test-renderer
// (project standard — @testing-library/react-native non installé).

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { inOut: () => undefined, ease: undefined },
    View,
  };
});

jest.mock("react-i18next", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts && "place_name" in opts
        ? `Le Chat fait le guet chez ${opts.place_name}…`
        : key,
  }),
}));

import { GuetIndicator } from "../../src/components/GuetIndicator";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: Array<TreeNode | string> | null;
};

type RenderOutput = TreeNode | TreeNode[] | null;

function renderTree(node: React.ReactElement): RenderOutput {
  let instance: { toJSON: () => RenderOutput } | null = null;
  TestRenderer.act(() => {
    instance = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return (instance as unknown as { toJSON: () => RenderOutput }).toJSON();
}

function asNodes(out: RenderOutput): TreeNode[] {
  if (!out) return [];
  return Array.isArray(out) ? out : [out];
}

function findFirstWithText(out: RenderOutput, needle: string): TreeNode | null {
  for (const tree of asNodes(out)) {
    const found = walkText(tree, needle);
    if (found) return found;
  }
  return null;
}

function walkText(tree: TreeNode, needle: string): TreeNode | null {
  if (tree.children) {
    for (const child of tree.children) {
      if (typeof child === "string") {
        if (child.includes(needle)) return tree;
        continue;
      }
      const inner = walkText(child, needle);
      if (inner) return inner;
    }
  }
  return null;
}

function findByAccessibilityLabel(
  out: RenderOutput,
  label: RegExp,
): TreeNode | null {
  for (const tree of asNodes(out)) {
    const found = walkLabel(tree, label);
    if (found) return found;
  }
  return null;
}

function walkLabel(tree: TreeNode, label: RegExp): TreeNode | null {
  const al = tree.props?.accessibilityLabel;
  if (typeof al === "string" && label.test(al)) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      if (typeof child === "string") continue;
      const inner = walkLabel(child, label);
      if (inner) return inner;
    }
  }
  return null;
}

describe("GuetIndicator", () => {
  it("retourne null si place === null (root view absent)", () => {
    const tree = renderTree(<GuetIndicator place={null} />);
    // ThemeProvider rend toujours un wrapper — on cherche absence d'accessibilityLabel guet
    const found = findByAccessibilityLabel(tree, /Le Chat fait le guet/);
    expect(found).toBeNull();
  });

  it("rend le label interpolé avec le nom du lieu", () => {
    const tree = renderTree(
      <GuetIndicator place={{ id: "p1", name: "Bô Zinc" }} />,
    );
    expect(findFirstWithText(tree, "Bô Zinc")).not.toBeNull();
  });

  it("a accessibilityLiveRegion 'polite' (VoiceOver/TalkBack)", () => {
    const tree = renderTree(
      <GuetIndicator place={{ id: "p1", name: "Bô Zinc" }} />,
    );
    const node = findByAccessibilityLabel(tree, /Bô Zinc/);
    expect(node?.props.accessibilityLiveRegion).toBe("polite");
  });
});
