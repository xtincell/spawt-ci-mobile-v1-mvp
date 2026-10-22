import { buildCrewInviteUrl, buildPlaceShareUrl, normalizeCrewInviteCode } from "../../src/lib/share-links";

describe("partages vers l'app installée", () => {
  it("dirige l'invitation vers le formulaire code et non vers un UUID de session", () => {
    expect(buildCrewInviteUrl(" abc23 ")).toBe("spawt://meute?crewCode=ABC23");
    expect(normalizeCrewInviteCode(" abc23 ")).toBe("ABC23");
    expect(normalizeCrewInviteCode("123456")).toBeNull();
    expect(normalizeCrewInviteCode("a/b?c")).toBeNull();
    expect(normalizeCrewInviteCode(undefined)).toBeNull();
  });

  it("encode le segment de la fiche vers la page publique avec ouverture dans l’app", () => {
    expect(buildPlaceShareUrl("lieu/a")).toBe("https://spawt.online/lieu/lieu%2Fa");
  });
});
