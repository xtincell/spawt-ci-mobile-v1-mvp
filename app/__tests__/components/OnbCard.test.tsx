// Story 2.5 — AC #4 : OnbCard primitive — selected vs unselected, onToggle, accessibility.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import { OnbCard } from "../../src/components/primitives/OnbCard";

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
    findAllByProps: (props: Record<string, unknown>) => FoundProps[];
  };
}

function render(node: ReactNode): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(node) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

function findPressable(instance: TestRendererInstanceLike, testID: string): FoundProps {
  const all = instance.root.findAllByProps({ testID });
  return all.find((n) => typeof n.props.onPress === "function") ?? all[0]!;
}

describe("<OnbCard /> — Story 2.5", () => {
  it("non-selected expose accessibilityState.checked=false", () => {
    const instance = render(
      <OnbCard label="Garba" altKey="garba" selected={false} onToggle={() => {}} testID="card" />,
    );
    const card = findPressable(instance, "card");
    expect(card.props.accessibilityRole).toBe("checkbox");
    expect(card.props.accessibilityState).toMatchObject({ checked: false });
  });

  it("selected expose accessibilityState.checked=true", () => {
    const instance = render(
      <OnbCard label="Garba" altKey="garba" selected={true} onToggle={() => {}} testID="card" />,
    );
    const card = findPressable(instance, "card");
    expect(card.props.accessibilityState).toMatchObject({ checked: true });
  });

  it("onToggle appelé au tap", () => {
    const onToggle = jest.fn();
    const instance = render(
      <OnbCard label="Garba" altKey="garba" selected={false} onToggle={onToggle} testID="card" />,
    );
    const card = findPressable(instance, "card");
    TestRenderer.act(() => {
      (card.props.onPress as () => void)();
    });
    expect(onToggle).toHaveBeenCalled();
  });
});
