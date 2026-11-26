import { Refine, type AuthActionResponse, type AuthProvider } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { LoginPage } from "./index";

const recovery = vi.hoisted(() => ({ enabled: true }));
vi.mock("../recovery", () => ({
  get staffRecoveryEnabled() { return recovery.enabled; },
}));

const refusal = "Impossible de se connecter. Vérifie tes identifiants ou réessaie.";

function renderLogin(login: AuthProvider["login"], returningFromRecovery = false) {
  const authProvider: AuthProvider = {
    login,
    logout: async () => ({ success: true }),
    check: async () => ({ authenticated: false }),
    onError: async () => ({}),
  };

  return render(
    <MemoryRouter initialEntries={[{
      pathname: "/login",
      state: returningFromRecovery ? { focusStaffAccessTitle: true } : undefined,
    }]}>
      <Refine authProvider={authProvider} routerProvider={routerProvider} options={{ disableTelemetry: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lieux" element={<h1>Lieux</h1>} />
        </Routes>
      </Refine>
    </MemoryRouter>,
  );
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.test" } });
  fireEvent.change(screen.getByLabelText("Mot de passe", { exact: true }), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

afterEach(() => {
  cleanup();
  recovery.enabled = true;
  vi.restoreAllMocks();
});

it("affiche le refus résolu, conserve la saisie et redirige après un nouvel essai réussi", async () => {
  const login = vi.fn()
    .mockResolvedValueOnce({ success: false, error: new Error("Compte non autorisé") })
    .mockResolvedValueOnce({ success: true, redirectTo: "/lieux" });
  renderLogin(login);

  submitLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent(refusal);
  expect(screen.queryByText("Compte non autorisé")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveValue("staff@example.test");
  expect(screen.getByLabelText("Mot de passe")).toHaveValue("test-password");

  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
  expect(await screen.findByRole("heading", { name: "Lieux" })).toBeInTheDocument();
  expect(login).toHaveBeenCalledTimes(2);
  expect(login).toHaveBeenNthCalledWith(2, { email: "staff@example.test", password: "test-password" });
});

it("garde le message générique lors d’un rejet du fournisseur", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  renderLogin(vi.fn().mockRejectedValue(new Error("Erreur interne du fournisseur")));

  submitLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent(refusal);
  expect(screen.queryByText("Erreur interne du fournisseur")).not.toBeInTheDocument();
});

it("affiche la connexion en cours et empêche une seconde soumission", async () => {
  let resolveLogin!: (response: AuthActionResponse) => void;
  const response = new Promise<AuthActionResponse>((resolve) => { resolveLogin = resolve; });
  const login = vi.fn().mockReturnValue(response);
  renderLogin(login);

  submitLogin();
  const pending = await screen.findByRole("button", { name: "Connexion…" });
  expect(pending).toBeDisabled();
  expect(pending.closest("form")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Connexion en cours…");
  fireEvent.submit(pending.closest("form")!);
  expect(login).toHaveBeenCalledTimes(1);

  await act(async () => resolveLogin({ success: false }));
  expect(await screen.findByRole("alert")).toHaveTextContent(refusal);
  expect(screen.getByRole("button", { name: "Se connecter" })).toBeEnabled();
});

it("place le lien après le formulaire et le masque si la récupération est désactivée", () => {
  const login = vi.fn();
  const { unmount } = renderLogin(login);
  const password = screen.getByLabelText("Mot de passe", { exact: true });
  const link = screen.getByRole("link", { name: /Mot de passe oublié/ });
  expect(password.closest("label")).not.toContainElement(link);
  expect(link).toHaveAttribute("href", "/mot-de-passe-oublie");
  expect(screen.getByRole("button", { name: "Se connecter" }).compareDocumentPosition(link))
    .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  unmount();

  recovery.enabled = false;
  renderLogin(login);
  expect(screen.queryByRole("link", { name: /Mot de passe oublié/ })).not.toBeInTheDocument();
});

it("replace le focus sur le titre au retour de la récupération", () => {
  renderLogin(vi.fn(), true);
  expect(screen.getByRole("heading", { name: "SPAWT admin" })).toHaveFocus();
});
