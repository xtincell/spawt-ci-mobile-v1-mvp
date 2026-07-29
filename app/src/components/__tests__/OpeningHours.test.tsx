// Story 4.12 — AC #2 + AC #5 : <OpeningHours /> rend les 7 jours, gère les
// jours fermés, les multi-créneaux, et met le jour courant en évidence.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { ThemeProvider } from "../../theme/ThemeProvider";
import { OpeningHours } from "../OpeningHours";
import type { DayOfWeek, OpeningSlot } from "../../types/place";

const HOURS: Record<DayOfWeek, OpeningSlot[]> = {
  mon: [{ open: "09:00", close: "17:00" }],
  tue: [
    { open: "12:00", close: "14:00" },
    { open: "19:00", close: "23:00" },
  ],
  wed: [{ open: "09:00", close: "17:00" }],
  thu: [{ open: "09:00", close: "17:00" }],
  fri: [{ open: "09:00", close: "17:00" }],
  sat: [],
  sun: [{ open: "10:00", close: "15:00" }],
};

interface NodeLike {
  props: Record<string, unknown>;
}
interface RendererLike {
  root: { findAllByType: (t: unknown) => NodeLike[] };
}

function render(today: DayOfWeek): RendererLike {
  let r: RendererLike | null = null;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <OpeningHours hours={HOURS} today={today} />
      </ThemeProvider>,
    ) as unknown as RendererLike;
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function texts(r: RendererLike): string[] {
  return r.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .filter((c): c is string => typeof c === "string");
}

describe("<OpeningHours /> — Story 4.12 AC #2", () => {
  beforeEach(() => mockTranslate.mockClear());

  it("rend les 7 jours (Lun→Dim)", () => {
    const t = texts(render("mon"));
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
      expect(t).toContain(`place.day_${day}`);
    }
  });

  it("affiche « Fermé » pour un jour sans créneau", () => {
    const t = texts(render("mon"));
    expect(t).toContain("place.info_hours_closed");
  });

  it("liste les multi-créneaux d'un même jour", () => {
    const t = texts(render("mon"));
    expect(t).toContain("12:00 – 14:00 · 19:00 – 23:00");
  });

  it("met le jour courant en évidence (fontWeight 700)", () => {
    const r = render("wed");
    const dayNodes = r.root
      .findAllByType(Text)
      .filter((n) => typeof n.props.children === "string");
    const wed = dayNodes.find((n) => n.props.children === "place.day_wed");
    const mon = dayNodes.find((n) => n.props.children === "place.day_mon");
    expect((wed?.props.style as { fontWeight?: string })?.fontWeight).toBe("700");
    expect((mon?.props.style as { fontWeight?: string })?.fontWeight).toBe("400");
  });
});
