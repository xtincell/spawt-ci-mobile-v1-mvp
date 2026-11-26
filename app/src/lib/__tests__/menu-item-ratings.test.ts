const mockRpc = jest.fn();
const mockHeader = jest.fn();
let mockOwner: string | null = "owner-a";
jest.mock("../supabase", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: mockOwner ? { user: { id: mockOwner }, access_token: "test-" + mockOwner } : null } }) },
  rpc: (name: string, args?: unknown) => ({
    setHeader: (key: string, value: string) => {
      mockHeader(key,value); return { abortSignal: () => mockRpc(name,args) };
    },
  }),
} }));
import { readMenuItemRating, writeMenuItemRating } from "../menu-item-ratings";

beforeEach(() => { mockOwner = "owner-a"; mockRpc.mockReset(); mockHeader.mockClear(); });
test("reads only the requested dish and preserves empty vs failed reads", async () => {
  mockRpc.mockResolvedValueOnce({data:[{menu_item_id:"second",rating:1},{menu_item_id:"dish",rating:4}],error:null})
    .mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:null,error:{code:"unavailable"}});
  await expect(readMenuItemRating("owner-a","dish")).resolves.toBe(4);
  await expect(readMenuItemRating("owner-a","dish")).resolves.toBeNull();
  await expect(readMenuItemRating("owner-a","dish")).rejects.toThrow();
  expect(mockHeader).toHaveBeenCalledWith("Authorization","Bearer test-owner-a");
});
test("adding, changing and clearing a rating uses only the dish-rating RPC", async () => {
  mockRpc.mockImplementation((_name,args) => ({data:args.p_rating,error:null}));
  for (const value of [3,5,null]) await writeMenuItemRating("owner-a","dish",value);
  expect(mockRpc.mock.calls).toEqual([3,5,null].map(value => ["set_menu_item_rating",{p_menu_item_id:"dish",p_rating:value}]));
});
test("refuses a stale account, fractional scores and unconfirmed writes", async () => {
  mockOwner="owner-b";
  await expect(writeMenuItemRating("owner-a","dish",4)).rejects.toThrow("session");
  await expect(readMenuItemRating("owner-a","dish")).rejects.toThrow("session");
  mockOwner="owner-a";
  for (const value of [0,6,2.5]) await expect(writeMenuItemRating("owner-a","dish",value)).rejects.toThrow();
  expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({data:null,error:null});
  await expect(writeMenuItemRating("owner-a","dish",3)).rejects.toThrow("unconfirmed");
});
