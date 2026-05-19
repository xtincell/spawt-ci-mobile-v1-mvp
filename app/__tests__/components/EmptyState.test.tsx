// Tests Story 3.1 — composant EmptyState (smoke).

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only; @types/react-test-renderer
// installable mais entre en conflit avec les types maison des autres tests
// (CatBubble/ChatBubble/OnbCard). À uniformiser dans une passe dédiée.
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findAllByType: (t: unknown) => TestInstanceLike[];
  };
}

function createInstance(element: ReactNode): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    ) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("renderer did not initialize");
  return raw;
}

describe("<EmptyState />", () => {
  it("rend titre + body sans CTA quand cta absent", () => {
    const instance = createInstance(
      <EmptyState title="Le Chat dort" body="Reviens plus tard" />,
    );
    const texts = instance.root.findAllByType(Text);
    const labels = texts.map((t) => t.props.children);
    expect(labels).toContain("Le Chat dort");
    expect(labels).toContain("Reviens plus tard");
    expect(labels).not.toContain("Action");
  });

  it("rend le CTA quand cta fourni", () => {
    const onPress = jest.fn();
    const instance = createInstance(
      <EmptyState
        title="Titre"
        body="Body"
        cta={{ label: "Action", onPress }}
      />,
    );
    const texts = instance.root.findAllByType(Text);
    const labels = texts.map((t) => t.props.children);
    expect(labels).toContain("Action");
  });
});
