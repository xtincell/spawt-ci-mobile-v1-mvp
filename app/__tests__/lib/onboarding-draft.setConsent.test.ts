// Story 2.2 — AC #7-3 : onboarding-draft.setConsent mute le bon champ
// du draft.consent sans toucher l'autre.

import { useOnboardingDraft } from "../../src/store/onboarding-draft";

describe("onboarding-draft.setConsent — Story 2.2", () => {
  beforeEach(() => {
    useOnboardingDraft.getState().reset();
  });

  it("setConsent(\"cgv\", iso) met à jour draft.consent.cgv_accepted_at uniquement", () => {
    const iso = "2026-05-17T20:00:00.000Z";
    useOnboardingDraft.getState().setConsent("cgv", iso);
    const draft = useOnboardingDraft.getState().draft;
    expect(draft.consent.cgv_accepted_at).toBe(iso);
    expect(draft.consent.geoloc_consent_at).toBeNull();
  });

  it("setConsent(\"geoloc\", iso) met à jour draft.consent.geoloc_consent_at uniquement", () => {
    const iso = "2026-05-17T20:00:00.000Z";
    useOnboardingDraft.getState().setConsent("geoloc", iso);
    const draft = useOnboardingDraft.getState().draft;
    expect(draft.consent.geoloc_consent_at).toBe(iso);
    expect(draft.consent.cgv_accepted_at).toBeNull();
  });

  it("reset() repasse draft.consent à { null, null }", () => {
    useOnboardingDraft.getState().setConsent("cgv", "2026-05-17T20:00:00.000Z");
    useOnboardingDraft.getState().setConsent("geoloc", "2026-05-17T20:00:00.000Z");
    useOnboardingDraft.getState().reset();
    const draft = useOnboardingDraft.getState().draft;
    expect(draft.consent.cgv_accepted_at).toBeNull();
    expect(draft.consent.geoloc_consent_at).toBeNull();
  });
});
