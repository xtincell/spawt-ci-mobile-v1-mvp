import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompteShow } from "./show";

const mock = vi.hoisted(() => ({ role: "admin", isDemo: true, isSeed: false }));
vi.mock("@refinedev/core", () => ({
  useGetIdentity: () => ({ data: { role: mock.role } }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ query: { isLoading: false, isError: false, data: { data: { id: "demo-id", display_name: "Alpha Démo 01", phone_e164: "+2250700000001", is_demo: mock.isDemo, is_seed: mock.isSeed, total_spawts: 0, unique_spots: 0, warning_count: 0 } } } }),
}));
vi.mock("react-router", () => ({ useParams: () => ({ id: "demo-id" }), useNavigate: () => vi.fn() }));
vi.mock("./index", () => ({ maskPhone: () => "+225 •• •• 01" }));
vi.mock("../../lib/moderate-spawter", () => ({ moderateSpawter: vi.fn() }));
vi.mock("../../lib/set-spawter-internal", () => ({ setSpawterInternal: vi.fn() }));
vi.mock("../../utility/supabaseClient", () => ({ supabaseClient: {} }));
afterEach(cleanup);
beforeEach(() => { mock.role = "admin"; mock.isDemo = true; mock.isSeed = false; });

it("réserve l'outil de suppression aux admins et aux seuls comptes démo", () => {
  const view = render(<CompteShow />);
  expect(screen.getByRole("button", { name: "Supprimer ce compte démo" })).toBeVisible();
  mock.role = "operator";
  view.rerender(<CompteShow />);
  expect(screen.queryByRole("button", { name: "Supprimer ce compte démo" })).not.toBeInTheDocument();
  mock.role = "admin";
  mock.isDemo = false;
  view.rerender(<CompteShow />);
  expect(screen.queryByRole("button", { name: "Supprimer ce compte démo" })).not.toBeInTheDocument();
  mock.isDemo = true;
  mock.isSeed = true;
  view.rerender(<CompteShow />);
  expect(screen.queryByRole("button", { name: "Supprimer ce compte démo" })).not.toBeInTheDocument();
});
