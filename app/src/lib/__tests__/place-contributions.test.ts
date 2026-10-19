import { contributionMenuPath, preciseRecentLocation } from "../../../../shared/place-contributions";
const mockSigned = jest.fn(); const mockRpc = jest.fn(); const mockUpload = jest.fn();
jest.mock("../supabase", () => ({ supabase: { storage: { from: () => ({ createSignedUrls: mockSigned, upload: mockUpload }) }, rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock("../data-source", () => ({ isSupabaseConfigured: true }));
jest.mock("../upload-body", () => ({ readUploadBody: async () => new ArrayBuffer(20) }));
import { resolveMenuUrls, submitContribution, uploadContributionPhoto } from "../place-contributions";
const owner = "eeee0000-0000-4000-8000-0000000085a1"; const id = "eeee0000-0000-4000-8000-0000000085d2";
const path = `${owner}/${id}/0.jpg`; const uri = `storage://place-contributions/${path}`;
describe("moderated place contributions", () => {
  beforeEach(() => jest.clearAllMocks());
  it("accepts only recent precise GPS observations", () => {
    const now = Date.now(); const proof = { lat: 5.3, lng: -4, accuracy_meters: 20, observed_at: new Date(now).toISOString() };
    expect(preciseRecentLocation(proof, now)).toBe(true);
    for (const bad of [{ accuracy_meters: 101 }, { accuracy_meters: -1 }, { lat: Infinity }, { lng: 181 }, { observed_at: new Date(now - 600001).toISOString() }, { observed_at: "invalid" }]) expect(preciseRecentLocation({ ...proof, ...bad }, now)).toBe(false);
  });
  it("resolves approved storage menus without leaking arbitrary paths", async () => {
    expect(contributionMenuPath(uri)).toBe(path); expect(contributionMenuPath(uri + "/../secret")).toBeNull();
    mockSigned.mockResolvedValue({ data: [{ path, signedUrl: "https://image/menu", error: null }], error: null });
    expect(await resolveMenuUrls(["https://legacy/menu", uri, "javascript:alert(1)"])).toEqual(["https://legacy/menu", "https://image/menu"]);
    expect(mockSigned).toHaveBeenCalledWith([path], 3600);
  });
  it("reports denied menu proofs instead of an empty menu", async () => {
    mockSigned.mockResolvedValue({ data: [{ path, error: "denied" }], error: null });
    await expect(resolveMenuUrls([uri])).rejects.toThrow("menu_unavailable");
  });
  it("retries an immutable upload after a lost response, never replacing it", async () => {
    mockUpload.mockResolvedValue({ error: { statusCode: "409" } });
    expect(await uploadContributionPhoto("file://photo.jpg", owner, id, 0)).toBe(path);
    expect(mockUpload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), { contentType: "image/jpeg", upsert: false });
    mockUpload.mockResolvedValue({ error: { statusCode: "403" } });
    await expect(uploadContributionPhoto("file://photo.jpg", owner, id, 0)).rejects.toEqual({ statusCode: "403" });
  });
  it("requires a server receipt and keeps the client ID for retries", async () => {
    mockRpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: id, error: null }) });
    expect(await submitContribution(id, "place", "menu", { photo_paths: [path] }, "  menu  ")).toBe(id);
    expect(mockRpc).toHaveBeenCalledWith("submit_place_contribution", expect.objectContaining({ p_id: id, p_comment: "menu", p_proposal: { photo_paths: [path] } }));
    mockRpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: null, error: null }) });
    await expect(submitContribution(id, "place", "menu", { photo_paths: [path] }, "menu")).rejects.toThrow("missing_receipt");
  });
});
