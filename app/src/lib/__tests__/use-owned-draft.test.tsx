// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOwnedDraft } from "../use-owned-draft";
interface Draft { text: string }
const create = (): Draft => ({ text: "" });
const validate = (value: unknown): value is Draft => !!value && typeof value === "object" && "text" in value && typeof value.text === "string";
let latest: ReturnType<typeof useOwnedDraft<Draft>>;
function Capture({ owner }: { owner: string }) { latest = useOwnedDraft(owner, create, validate); return null; }
const resolvers = new Map<string, (value: string | null) => void>();
let renderer: ReturnType<typeof TestRenderer.create>;
beforeEach(() => {
  jest.clearAllMocks(); resolvers.clear();
  jest.mocked(AsyncStorage.getItem).mockImplementation(key => new Promise(resolve => { resolvers.set(key, resolve); }));
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
});
afterEach(() => TestRenderer.act(() => renderer?.unmount()));
const mount = (owner: string) => TestRenderer.act(() => { renderer = TestRenderer.create(<Capture owner={owner} />); });
const load = async (owner: string, text: string | null) => { await TestRenderer.act(async () => { resolvers.get(owner)!(text === null ? null : JSON.stringify({ text })); }); };
describe("draft ownership across account changes", () => {
  it("never writes the previous account draft to the new account key", async () => {
    mount("account-a"); await load("account-a", "private-a");
    expect(latest.draft.text).toBe("private-a"); expect(latest.ready).toBe(true);
    const oldUpdate = latest.setDraft;
    TestRenderer.act(() => renderer.update(<Capture owner="account-b" />));
    expect(latest.ready).toBe(false); expect(latest.draft.text).toBe("");
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith("account-b", JSON.stringify({ text: "private-a" }));
    await load("account-b", "private-b");
    TestRenderer.act(() => oldUpdate({ text: "late-a" }));
    expect(latest.draft.text).toBe("private-b");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith("account-b", JSON.stringify({ text: "private-b" }));
  });
  it("ignores a slow read from the previous account", async () => {
    mount("account-a"); TestRenderer.act(() => renderer.update(<Capture owner="account-b" />));
    await load("account-b", "private-b"); await load("account-a", "late-private-a");
    expect(latest.ready).toBe(true); expect(latest.draft.text).toBe("private-b");
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith("account-b", JSON.stringify({ text: "late-private-a" }));
  });
  it("restores and persists a valid draft for the same account", async () => {
    mount("account-a"); await load("account-a", "saved");
    TestRenderer.act(() => latest.setDraft(previous => ({ text: previous.text + " updated" })));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith("account-a", JSON.stringify({ text: "saved updated" }));
  });
});
