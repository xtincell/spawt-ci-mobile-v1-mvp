// Story 7.1 — AC #3 + AC #4 : <BuildBadge /> rend « v1.0.0 — build N (date) »
// depuis des valeurs injectées, et tombe sur « — » quand les valeurs natives
// manquent (dev / Expo Go) sans crash.

import { type ReactElement } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

const mockTranslate = jest.fn(
  (key: string, opts?: Record<string, unknown>) =>
    key === "profile.build_format" && opts
      ? `v${String(opts.version)} — build ${String(opts.n)} (${String(opts.date)})`
      : key,
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
// Valeurs natives nulles par défaut (env test) — chaque test surcharge via props.
jest.mock("expo-application", () => ({
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
}));

import { ThemeProvider } from "../../../theme/ThemeProvider";
import { BuildBadge } from "../BuildBadge";

interface NodeLike {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: { findAllByType: (t: unknown) => NodeLike[] };
}

function texts(el: ReactElement): string[] {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>{el}</ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return (r as RendererLike).root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .filter((c): c is string => typeof c === "string");
}

describe("<BuildBadge /> — Story 7.1", () => {
  beforeEach(() => mockTranslate.mockClear());

  it("rend le format canonique depuis des valeurs injectées", () => {
    const t = texts(
      <BuildBadge version="1.0.0" buildNumber="7" buildDate="2026-06-01" />,
    );
    expect(t).toContain("v1.0.0 — build 7 (2026-06-01)");
  });

  it("fallback « — » quand version native + build date absents", () => {
    const t = texts(<BuildBadge />);
    // version par défaut "1.0.0", buildNumber et date absents → « — ».
    expect(t).toContain("v1.0.0 — build — (—)");
  });
});
