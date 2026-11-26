import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PilotPage } from ".";
const mocks = vi.hoisted(() => ({identity:vi.fn(),rpc:vi.fn()}));
vi.mock("@refinedev/core", () => ({useGetIdentity:mocks.identity}));
vi.mock("../../utility/supabaseClient", () => ({supabaseClient:{rpc:mocks.rpc}}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("ne requête pas les données pour un opérateur", () => {
  mocks.identity.mockReturnValue({data:{role:"operator"}});
  render(<PilotPage />);
  expect(screen.getByRole("alert").textContent).toMatch(/administrateurs/);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("sépare les jalons, affiche le lieu et recharge la période sélectionnée", async () => {
  mocks.identity.mockReturnValue({data:{role:"admin"}});
  mocks.rpc.mockResolvedValue({data:{
    checked_at:"2026-11-30T10:00:00Z",onboarded:2,active:1,viewers:7,savers:3,
    origins:[{origin:"facebook",arrivals:15,download_clicks:9,first_opens:6,acquired_installs:4,reopens:5,viewers:7,savers:3,active_people:1,spawters:0}],
    recent:[{at_utc:"2026-11-30T10:00:00Z",origin:"facebook",place:"Le Cha",person_ref:"ab01"}]
  },error:null});
  render(<PilotPage />);
  expect((await screen.findByText("Le Cha")).textContent).toBe("Le Cha");
  expect(screen.getByText("Clics Télécharger").nextElementSibling?.textContent).toBe("9");
  expect(screen.getByText("Onboardings reçus").nextElementSibling?.textContent).toBe("2");
  expect(screen.getByText("Personnes activées").nextElementSibling?.textContent).toBe("1");
  fireEvent.change(screen.getByRole("combobox"),{target:{value:"pilot"}});
  await waitFor(()=>expect(mocks.rpc).toHaveBeenLastCalledWith("admin_pilot_funnel",{p_start:"2026-11-28T00:00:00Z",p_end:"2026-12-05T00:00:00Z"}));
});
it("affiche l’indisponibilité sans fabriquer de zéro", async () => {
  mocks.identity.mockReturnValue({data:{role:"admin"}});
  mocks.rpc.mockResolvedValue({error:{message:"unavailable"}});
  render(<PilotPage />);
  expect((await screen.findByRole("alert")).textContent).toMatch(/indisponibles/);
  expect(screen.queryByText("Personnes activées")).toBeNull();
});
