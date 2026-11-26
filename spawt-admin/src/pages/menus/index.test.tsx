import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MenusPage } from "./index";
const mock = vi.hoisted(() => ({ writes: [] as unknown[], dishes: [] as Record<string, unknown>[], conflict: false }));
vi.mock("../../utility/supabaseClient", async () => {
 const { createFromMock } = await import("../../test/supabaseMock");
 return { supabaseClient: { from: createFromMock(ctx => {
  if (ctx.op !== "select") { mock.writes.push(ctx); return { data: mock.conflict ? [] : [{ id: "dish" }], error: null }; }
  if (ctx.table === "places") return { data: [{ id: "p", name: "Lieu témoin" }], error: null };
  return { data: mock.dishes, error: null };
 }) } };
});
beforeEach(() => { mock.writes = []; mock.dishes = []; mock.conflict = false; }); afterEach(cleanup);
async function complete() {
 render(<MenusPage />); await screen.findByRole("option", { name: "Lieu témoin" });
 fireEvent.change(screen.getByLabelText("Lieu"), { target: { value: "p" } });
 fireEvent.change(screen.getByLabelText("Nom du plat"), { target: { value: "Attiéké poisson" } });
 fireEvent.change(screen.getByLabelText(/Source vérifiée/), { target: { value: "https://example.test/menu" } });
}
it("keeps unknown prices null and defaults to a private draft", async () => {
 await complete(); fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 await waitFor(() => expect(mock.writes).toHaveLength(1));
 expect(mock.writes[0]).toMatchObject({ table: "menu_items", op: "insert", payload: { dish_type: null, price_xof: null, is_published: false, source_url: "https://example.test/menu" } });
});
const existing = {
 id: "dish", place_id: "p", name: "Burger maison", dish_type: "burger", aliases: [], accompaniments: [],
 price_xof: 4500, description: "", photo_url: null, source_url: "menu maison", observed_on: "2026-01-11", is_published: true, updated_at: "2026-01-12T10:00:00Z",
};
it.each([
 [undefined, "burger"], ["burger-poisson", "burger-poisson"], ["", null],
])("preserves, corrects and clears a classified dish on a guarded update", async (input, expected) => {
 mock.dishes = [existing, { ...existing, id: "other" }];
 render(<MenusPage />);
 const buttons = await screen.findAllByRole("button", { name: "Modifier" });
 fireEvent.click(buttons[0]);
 const field = screen.getByLabelText("Type de plat");
 expect(field).toHaveValue("burger");
 expect(document.querySelectorAll("#menu-dish-types option")).toHaveLength(1);
 expect(document.querySelector("#menu-dish-types option")).toHaveAttribute("value", "burger");
 if (input !== undefined) fireEvent.change(field, { target: { value: input } });
 fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 await waitFor(() => expect(mock.writes).toHaveLength(1));
 expect(mock.writes[0]).toMatchObject({ op: "update", payload: { dish_type: expected },
   calls: { eq: [["id", existing.id], ["updated_at", existing.updated_at]] } });
});
it.each(["non_classe", "1burger", "Plat du jour", "pâtisserie", "a".repeat(41)])("refuses invalid or reserved type %s", async value => {
 await complete();
 fireEvent.change(screen.getByLabelText("Type de plat"), { target: { value } });
 fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 expect(await screen.findByRole("alert")).toBeInTheDocument();
 expect(mock.writes).toHaveLength(0);
});
it("creates a new editorial type within the SQL naming rules", async () => {
 await complete();
 fireEvent.change(screen.getByLabelText("Type de plat"), { target: { value: "oeufs_2" } });
 fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 await waitFor(() => expect(mock.writes[0]).toMatchObject({ op: "insert", payload: { dish_type: "oeufs_2" }}));
});
it("keeps the entered dish and reports an unconfirmed write", async () => {
 await complete(); mock.conflict = true; fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("Ce plat a changé");
 expect(screen.getByLabelText("Nom du plat")).toHaveValue("Attiéké poisson");
});
