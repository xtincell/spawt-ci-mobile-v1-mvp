// Page Tarifs (0079) — rendu avec client Supabase mocké : lecture pour tout le
// staff, saisie réservée aux admins, aperçu HT/TVA, appel de la RPC.
// Montants recherchés avec des espaces simples : Testing Library normalise les
// espaces insécables de formatXof dans le DOM, pas dans la chaîne cherchée.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TarifsPage } from "./index";
import { updatePlan } from "../../lib/update-plan";

const mock = vi.hoisted(() => ({
  role: "admin" as "admin" | "moderator" | "operator",
  plans: [] as unknown[],
}));

vi.mock("@refinedev/core", () => ({
  useGetIdentity: () => ({ data: { role: mock.role } }),
}));

vi.mock("../../lib/update-plan", () => ({
  updatePlan: vi.fn(async (code: string, priceTtc: number, isActive: boolean) => ({
    ok: true,
    plan: { changed: true, code, price_ttc: priceTtc, price_ht: 0, tva_amount: 0, is_active: isActive, updated_at: "" },
  })),
}));

vi.mock("../../utility/supabaseClient", async () => {
  const { createFromMock } = await import("../../test/supabaseMock");
  return {
    supabaseClient: {
      from: createFromMock((ctx) => {
        if (ctx.table === "plans") return { data: mock.plans, error: null };
        return { data: [], error: null }; // journal d'audit vide
      }),
    },
  };
});

// Fixture : une ligne `plans` après 0079.
const GOLD_LIEU = {
  id: "p-gold-lieu",
  code: "b2b_gold",
  label: "Spawt Gold — lieu",
  period: "monthly",
  price_ttc: 60000,
  price_ht: 50847,
  tva_amount: 9153,
  is_active: true,
  updated_at: "2026-10-18T10:00:00Z",
};

beforeEach(() => {
  mock.role = "admin";
  mock.plans = [GOLD_LIEU];
  vi.mocked(updatePlan).mockClear();
});
afterEach(cleanup);

describe("TarifsPage", () => {
  it("affiche prix payé, HT et TVA dérivés, et la règle des nouveaux paiements", async () => {
    render(<TarifsPage />);
    expect(await screen.findByText("Spawt Gold — lieu")).toBeInTheDocument();
    expect(screen.getByText("50 847 F")).toBeInTheDocument();
    expect(screen.getByText("9 153 F")).toBeInTheDocument();
    expect(screen.getByText(/Un nouveau prix vaut pour les nouveaux paiements/)).toBeInTheDocument();
    expect(screen.getByText(/factures\s+déjà émises gardent leur montant/)).toBeInTheDocument();
  });

  it("réserve la saisie aux admins : un opérateur lit sans champ ni bouton", async () => {
    mock.role = "operator";
    render(<TarifsPage />);
    expect(await screen.findByText("60 000 F")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByText(/Lecture seule/)).toBeInTheDocument();
  });

  it("un admin voit HT et TVA suivre sa saisie, confirme avec un motif, et la RPC reçoit le prix payé", async () => {
    render(<TarifsPage />);
    const champ = await screen.findByRole("textbox", { name: "Prix payé — Spawt Gold — lieu" });
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    fireEvent.change(champ, { target: { value: "55 050" } });
    expect(screen.getByText("46 653 F")).toBeInTheDocument();
    expect(screen.getByText("8 397 F")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText(/Prix payé : 60 000 F → 55 050 F/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Motif/ }), {
      target: { value: "nouvelle grille" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le tarif" }));

    await waitFor(() =>
      expect(updatePlan).toHaveBeenCalledWith("b2b_gold", 55050, true, "nouvelle grille"),
    );
  });

  it("une saisie invalide est signalée et ne s'enregistre pas", async () => {
    render(<TarifsPage />);
    const champ = await screen.findByRole("textbox", { name: "Prix payé — Spawt Gold — lieu" });
    fireEvent.change(champ, { target: { value: "60000,5" } });
    expect(screen.getByRole("alert")).toHaveTextContent("sans virgule");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });
});
