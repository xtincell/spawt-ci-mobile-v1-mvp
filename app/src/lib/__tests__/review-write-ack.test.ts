const mockSingle = jest.fn();
const mockBuilder = { update: jest.fn(), eq: jest.fn(), select: jest.fn(), maybeSingle: mockSingle };
for (const name of ["update", "eq", "select"] as const) mockBuilder[name].mockImplementation(() => mockBuilder);
jest.mock("../supabase", () => ({ supabase: { from: () => mockBuilder } }));
import { updateSpawtInSupabase } from "../data-source.supabase";
test("une mise à jour à zéro ligne n'est jamais acquittée", async () => {
 mockSingle.mockResolvedValueOnce({ data: null, error: null });
 expect(await updateSpawtInSupabase("missing", { note_etoiles: 4 })).toBe(false);
 mockSingle.mockResolvedValueOnce({ data: { id: "found" }, error: null });
 expect(await updateSpawtInSupabase("found", { note_etoiles: 4 })).toBe(true);
});
