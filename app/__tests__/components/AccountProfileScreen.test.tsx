import type { ReactNode } from "react";
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import type { SpawtCheckin } from "../../src/types/spawt";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/lib/storage", () => ({ resetAll: jest.fn() }));
jest.mock("../../src/lib/offline-queue", () => ({ inspect: async () => [] }));
jest.mock("../../src/lib/storage-avatars", () => ({ compressAvatar: jest.fn(), uploadAvatar: jest.fn() }));
jest.mock("../../src/lib/data-source", () => ({ isSupabaseConfigured: false, listMyCoupsDeCoeur: async () => [] }));
jest.mock("../../src/store/feature-flags", () => ({ useFlag: () => false }));
jest.mock("../../src/store/progression-store", () => ({
  useProgressionStore: (selector: (state: object) => unknown) => selector({ badges: null, hydrate: jest.fn() }),
}));
jest.mock("../../src/components/primitives/BuildBadge", () => ({ BuildBadge: () => null }));
jest.mock("../../src/components/ChatBubble", () => ({ ChatBubble: () => null }));
jest.mock("../../src/components/profile/ArchetypeCard", () => ({ ArchetypeCard: () => null }));
jest.mock("../../src/components/profile/CollectionTitlesSection", () => ({ CollectionTitlesSection: () => null }));
jest.mock("../../src/components/OfflineQueueInspector", () => ({ OfflineQueueInspector: () => null }));
jest.mock("../../src/components/SpawterCard", () => ({
  SpawterCard: (props: object) => jest.requireActual("react").createElement("ProfileCard", props),
}));

let mockSpawts: SpawtCheckin[] = [];
let mockSaved = new Set<string>();
const mockProfile = {
  id: "spawter-1", display_name: "Moka", stade: "touriste", neighborhood: "Cocody",
  total_spawts: 99, unique_spots: 88, quiz_archetype: null,
};
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: (selector: (state: object) => unknown) => selector({
    spawter: mockProfile, palais: { confidence_score: 0.5 }, spawts: mockSpawts,
    savedPlaceIds: mockSaved, collectionTitres: [], pendingMue: null,
    gold: { active: true, plan: "gold_monthly", expires_at: "2099-01-01T00:00:00Z" },
    setDisplayedTitle: jest.fn(), clearDisplayedTitle: jest.fn(), updateAvatar: jest.fn(),
    reset: jest.fn(), consumePendingMue: jest.fn(),
  }),
}));

import AccountProfileScreen from "../../app/(tabs)/profile";

interface RendererLike {
  root: {
    findByType: (type: string) => { props: Record<string, unknown> };
    findAllByProps: (props: Record<string, unknown>) => Array<{ props: Record<string, unknown> }>;
  };
  update: (node: ReactNode) => void;
  unmount: () => void;
}

function visit(id: string, placeId: string, patch: Partial<SpawtCheckin> = {}): SpawtCheckin {
  return {
    id, place_id: placeId, spawter_id: mockProfile.id,
    checked_in_at: "2026-10-30T12:00:00Z", check_in_type: "manual",
    is_verified: false, is_seed: false, is_cancelled: false, ...patch,
  } as SpawtCheckin;
}

describe("le profil distingue établissements visités et favoris", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSpawts = [];
    mockSaved = new Set();
  });
  afterEach(() => jest.useRealTimers());

  it("déduplique les lieux, écarte les passages non déclarés et suit une annulation", async () => {
    mockSpawts = [
      visit("1", "lieu-a"), visit("2", "lieu-a", { is_verified: true }),
      visit("3", "lieu-b"), visit("4", "seed", { is_seed: true }),
      visit("5", "annule", { is_cancelled: true }),
      visit("6", "passif", { check_in_type: "passive" }),
      visit("7", "en-cours", { checked_in_at: null }),
    ];
    mockSaved = new Set(["favori-a", "favori-b", "favori-c"]);
    let rendered!: RendererLike;
    await TestRenderer.act(async () => {
      rendered = TestRenderer.create(<AccountProfileScreen />) as unknown as RendererLike;
    });
    expect(rendered.root.findByType("ProfileCard").props).toMatchObject({ spawtsCount: 2, savedCount: 3 });
    expect(rendered.root.findAllByProps({ testID: "profile-gold-indicator" })).toHaveLength(0);

    mockSpawts = mockSpawts.map(row => row.place_id === "lieu-b" ? { ...row, is_cancelled: true } : row);
    await TestRenderer.act(async () => { rendered.update(<AccountProfileScreen />); });
    expect(rendered.root.findByType("ProfileCard").props).toMatchObject({ spawtsCount: 1, savedCount: 3 });
    TestRenderer.act(() => rendered.unmount());
  });
});
