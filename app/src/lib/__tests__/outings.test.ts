import AsyncStorage from "@react-native-async-storage/async-storage";
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-crypto", () => { let n = 0; return { randomUUID: () => `mutation-${++n}` }; });
jest.mock("../data-source", () => ({ dataSourceMode: "supabase" }));
let mockOwner = "a"; const mockRpc = jest.fn();
jest.mock("../supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: mockOwner } } } }) }, rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }) } }));
import { enqueueOuting, localOutings, syncOutings, emptyOutings } from "../outings";
const current = () => mockOwner === "a";
beforeEach(async () => { await AsyncStorage.clear(); mockOwner = "a"; mockRpc.mockReset(); });
test("an offline save survives restart and replays the same server receipt", async () => {
 await enqueueOuting("a", "list_create", { list_id: "l", title: "Vendredi" }, current);
 mockRpc.mockRejectedValue(new Error("offline"));
 await expect(syncOutings("a", current)).rejects.toThrow();
 expect((await localOutings("a")).snapshot.lists[0]!.title).toBe("Vendredi");
 const receipt = mockRpc.mock.calls[0][1].p_id;
 mockRpc.mockImplementation(async name => name === "my_outings" ? { data: { ...emptyOutings(), lists: [{ id: "l", title: "Vendredi" }] }, error: null } : { error: null });
 await syncOutings("a", current);
 expect(mockRpc.mock.calls[1][1].p_id).toBe(receipt);
 expect(await localOutings("a")).toMatchObject({ pending: 0, rejected: 0 });
});
test("server rejection remains visible, rather than being retried forever", async () => {
 await enqueueOuting("a", "save", { menu_item_id: "retired" }, current);
 mockRpc.mockImplementation(async name => name === "mutate_outing" ? { error: { code: "22023" } } : { data: emptyOutings(), error: null });
 await syncOutings("a", current); await syncOutings("a", current);
 expect((await localOutings("a")).rejected).toBe(1);
 expect(mockRpc.mock.calls.filter(c => c[0] === "mutate_outing")).toHaveLength(1);
});
test("late acknowledgment cannot publish one account's snapshot under another", async () => {
 await enqueueOuting("a", "list_create", { list_id: "l", title: "Privée" }, current);
 mockRpc.mockImplementation(async () => { mockOwner = "b"; return { error: null }; });
 await syncOutings("a", current);
 expect((await localOutings("a")).pending).toBe(1);
 expect((await localOutings("b")).snapshot.lists).toEqual([]);
 expect(mockRpc.mock.calls[0][1].p_owner).toBe("a");
 await expect(enqueueOuting("a", "choose", {}, current)).rejects.toThrow("session_changed");
});
test("an RPC under a different authenticated identity is never attempted", async () => {
 await enqueueOuting("a", "choose", { place_id: "p" }, current);
 mockOwner = "b";
 await syncOutings("a", () => true);
 expect(mockRpc).not.toHaveBeenCalled(); expect((await localOutings("a")).pending).toBe(1);
});

test("classifying then removing a place offline retains the latest local choice", async () => {
 await enqueueOuting("a", "list_add", { list_id: "l", place_id: "p" }, current);
 expect((await localOutings("a")).pendingPlaces.p).toBe(true);
 await enqueueOuting("a", "unsave", { place_id: "p" }, current);
 const local = await localOutings("a");
 expect(local.pendingPlaces.p).toBe(false); expect(local.snapshot.items).toHaveLength(0);
 expect(local.pending).toBe(2);
});

test("actions queued during the final snapshot read are sent without another screen refresh", async () => {
 let releaseRead!: (value: unknown) => void;
 let notifyRead!: () => void;
 const reading = new Promise<void>(resolve => { notifyRead = resolve; });
 const staleRead = new Promise(resolve => { releaseRead = resolve; });
 let reads = 0;
 const received: string[] = [];
 mockRpc.mockImplementation((name, args) => {
  if (name === "mutate_outing") { received.push(args.p_action); return Promise.resolve({ error: null }); }
  if (reads++ === 0) { notifyRead(); return staleRead; }
  return Promise.resolve({ data: { ...emptyOutings(), lists: [{ id: "l", title: "Brunch", share_token: "public-link" }] }, error: null });
 });
 const refresh = syncOutings("a", current);
 await reading;
 await enqueueOuting("a", "list_create", { list_id: "l", title: "Brunch" }, current);
 const create = syncOutings("a", current);
 await enqueueOuting("a", "list_share", { list_id: "l", enabled: true }, current);
 const share = syncOutings("a", current);
 releaseRead({ data: emptyOutings(), error: null });
 await Promise.all([refresh, create, share]);
 expect(received).toEqual(["list_create", "list_share"]);
 expect(await localOutings("a")).toMatchObject({ pending: 0, rejected: 0, snapshot: { lists: [{ id: "l", share_token: "public-link" }] } });
});

test("a waiting sync cannot resume its queued writes after the account changes", async () => {
 let releaseRead!: (value: unknown) => void;
 let notifyRead!: () => void;
 const reading = new Promise<void>(resolve => { notifyRead = resolve; });
 mockRpc.mockImplementation(() => { notifyRead(); return new Promise(resolve => { releaseRead = resolve; }); });
 const refresh = syncOutings("a", current);
 await reading;
 await enqueueOuting("a", "choose", { place_id: "p" }, current);
 const waiting = syncOutings("a", current);
 mockOwner = "b";
 releaseRead({ data: emptyOutings(), error: null });
 await Promise.all([refresh, waiting]);
 expect(mockRpc.mock.calls.map(c => c[0])).toEqual(["my_outings"]);
 expect((await localOutings("a")).pending).toBe(1);
 expect((await localOutings("b")).pending).toBe(0);
});
