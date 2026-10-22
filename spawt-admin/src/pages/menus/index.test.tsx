import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MenusPage } from "./index";
const mock = vi.hoisted(() => ({ writes: [] as unknown[], conflict: false }));
vi.mock("../../utility/supabaseClient", async () => {
 const { createFromMock } = await import("../../test/supabaseMock");
 return { supabaseClient: { from: createFromMock(ctx => {
  if (ctx.op !== "select") { mock.writes.push(ctx); return { data: mock.conflict ? [] : [{ id: "dish" }], error: null }; }
  if (ctx.table === "places") return { data: [{ id: "p", name: "Lieu témoin" }], error: null };
  return { data: [], error: null };
 }) } };
});
beforeEach(() => { mock.writes = []; mock.conflict = false; }); afterEach(cleanup);
async function complete() {
 render(<MenusPage />); await screen.findByRole("option", { name: "Lieu témoin" });
 fireEvent.change(screen.getByLabelText("Lieu"), { target: { value: "p" } });
 fireEvent.change(screen.getByLabelText("Nom du plat"), { target: { value: "Attiéké poisson" } });
 fireEvent.change(screen.getByLabelText(/Source vérifiée/), { target: { value: "https://example.test/menu" } });
}
it("keeps unknown prices null and defaults to a private draft", async () => {
 await complete(); fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 await waitFor(() => expect(mock.writes).toHaveLength(1));
 expect(mock.writes[0]).toMatchObject({ table: "menu_items", op: "insert", payload: { price_xof: null, is_published: false, source_url: "https://example.test/menu" } });
});
it("keeps the entered dish and reports an unconfirmed write", async () => {
 await complete(); mock.conflict = true; fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("Ce plat a changé");
 expect(screen.getByLabelText("Nom du plat")).toHaveValue("Attiéké poisson");
});
