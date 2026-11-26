import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({send:vi.fn(),verify:vi.fn(),staff:vi.fn(),update:vi.fn(),signOut:vi.fn()}));
vi.mock("../../utility/supabaseClient",()=>({createStaffRecoveryClient:()=>({
 auth:{resetPasswordForEmail:m.send,verifyOtp:m.verify,updateUser:m.update,signOut:m.signOut},
 rpc:()=>({maybeSingle:m.staff}),
})}));
const token="a".repeat(56);
beforeEach(()=>{vi.stubEnv("VITE_STAFF_RECOVERY_ENABLED","true");vi.resetModules();
 m.send.mockResolvedValue({error:null}); m.verify.mockResolvedValue({data:{session:{}},error:null});
 m.signOut.mockResolvedValue({error:null});m.update.mockResolvedValue({error:null});
 m.staff.mockResolvedValue({data:{id:"test"},error:null});
});
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.clearAllMocks();window.history.replaceState(null,"","/");});
it("accepts the GoTrue 56-character hash, rejects duplicates and empty input",async()=>{
 const {staffRecoveryToken}=await import(".");
 expect(staffRecoveryToken("#token_hash="+token)).toBe(token);
 expect(staffRecoveryToken("#token_hash="+token+"&token_hash="+token)).toBe("");
 expect(staffRecoveryToken("#token_hash=bad")).toBe("");
});
it("sends a reset request with only the staff callback, and never confirms the account exists",async()=>{
 const {StaffRecoveryRequest}=await import(".");
 render(<MemoryRouter><StaffRecoveryRequest/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText(/Adresse e-mail/),{target:{value:"staff@example.test"}});
 fireEvent.click(screen.getByRole("button",{name:"Envoyer le lien"}));
 expect((await screen.findByRole("status")).textContent).toMatch(/Si cette adresse/);
 expect(m.send).toHaveBeenCalledWith("staff@example.test",{redirectTo:window.location.origin+"/reinitialiser"});
});
it("only exchanges a link upon form submission; blocks non-staff password changes",async()=>{
 const {StaffRecoveryReset}=await import(".");
 window.history.replaceState(null,"","/reinitialiser#token_hash="+token);m.staff.mockResolvedValue({data:null,error:null});
 render(<MemoryRouter><StaffRecoveryReset/></MemoryRouter>);
 expect(window.location.hash).toBe("");expect(m.verify).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText("Nouveau mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.change(screen.getByLabelText("Confirme le mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.click(screen.getByRole("button",{name:"Modifier le mot de passe"}));
 expect((await screen.findByRole("alert")).textContent).toMatch(/invalide ou expiré/);
 expect(m.verify).toHaveBeenCalledWith({type:"recovery",token_hash:token});expect(m.update).not.toHaveBeenCalled();
});
it("changes the password only for an active staff member and requests global and local sign-out",async()=>{
 const {StaffRecoveryReset}=await import(".");
 window.history.replaceState(null,"","/reinitialiser#token_hash="+token);
 render(<MemoryRouter><StaffRecoveryReset/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText("Nouveau mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.change(screen.getByLabelText("Confirme le mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.click(screen.getByRole("button",{name:"Modifier le mot de passe"}));
 const status = await screen.findByRole("status");
 expect(status.textContent).toMatch(/Mot de passe modifié/);
 expect(document.activeElement).toBe(status);
 expect(screen.queryByText(/Choisis un mot de passe/)).toBeNull();
 expect(m.update).toHaveBeenCalledWith({password:"Test-password-2026"});
 expect(m.signOut).toHaveBeenNthCalledWith(1, {scope:"global"});
 expect(m.signOut).toHaveBeenNthCalledWith(2, {scope:"local"});
});

it("renders identical confirmations for success, unknown account, throttling and server errors", async () => {
  const { StaffRecoveryRequest } = await import(".");
  m.send
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { status: 404, message: "User not found" } })
    .mockResolvedValueOnce({ error: { status: 429 } })
    .mockResolvedValueOnce({ error: { status: 503 } });
  const confirmations = [];
  for (const address of ["staff@example.test", "unknown@example.test", "limited@example.test", "unavailable@example.test"]) {
    const view = render(<MemoryRouter><StaffRecoveryRequest /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: address } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    const status = await screen.findByRole("status");
    expect(document.activeElement).toBe(status);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/Saisis ton adresse/)).toBeNull();
    confirmations.push(status.textContent);
    fireEvent.click(screen.getByRole("button", { name: "Faire une nouvelle demande" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Adresse e-mail"));
    view.unmount();
  }
  expect(confirmations[0]).toMatch(/^Si cette adresse est associée à un compte/);
  expect(new Set(confirmations).size).toBe(1);
});

it("announces request progress, ignores duplicate submits, and preserves email on retry", async () => {
  const { StaffRecoveryRequest } = await import(".");
  let resolveSend!: (result: { error: { status: number } }) => void;
  m.send.mockReturnValueOnce(new Promise(resolve => { resolveSend = resolve; }));
  const { container } = render(<MemoryRouter><StaffRecoveryRequest /></MemoryRouter>);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Mot de passe oublié" }));
  const input = screen.getByLabelText<HTMLInputElement>("Adresse e-mail");
  fireEvent.change(input, { target: { value: "staff@example.test" } });
  fireEvent.submit(input.form!);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Envoi en cours…" }).disabled).toBe(true);
  expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("Envoi en cours…");
  fireEvent.submit(input.form!);
  expect(m.send).toHaveBeenCalledTimes(1);
  resolveSend({ error: { status: 0 } });
  const error = await screen.findByRole("alert");
  expect(error.textContent).toMatch(/Réessaie dans quelques minutes/);
  expect(document.activeElement).toBe(error);
  expect(input.value).toBe("staff@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
  expect((await screen.findByRole("status")).textContent).toMatch(/Si cette adresse/);
});

it("keeps recovery disabled without exposing form actions", async () => {
  vi.stubEnv("VITE_STAFF_RECOVERY_ENABLED", "false");
  const { StaffRecoveryRequest } = await import(".");
  render(<MemoryRouter><StaffRecoveryRequest /></MemoryRouter>);
  expect(screen.getByRole("alert").textContent).toMatch(/pas encore disponible/);
  expect(screen.queryByRole("button")).toBeNull();
  expect(m.send).not.toHaveBeenCalled();
});

it("focuses the mismatched confirmation and allows correction without using the link", async () => {
  const { StaffRecoveryReset } = await import(".");
  window.history.replaceState(null, "", "/reinitialiser#token_hash=" + token);
  render(<MemoryRouter><StaffRecoveryReset /></MemoryRouter>);
  const password = screen.getByLabelText<HTMLInputElement>("Nouveau mot de passe");
  const confirmation = screen.getByLabelText<HTMLInputElement>("Confirme le mot de passe");
  fireEvent.change(password, { target: { value: "Test-password-2026" } });
  fireEvent.change(confirmation, { target: { value: "Other-password-2026" } });
  const submit = screen.getByRole("button", { name: "Modifier le mot de passe" });
  fireEvent.click(submit);
  const error = screen.getByRole("alert");
  expect(error.textContent).toMatch(/ne correspondent pas/);
  expect(confirmation.getAttribute("aria-describedby")).toBe(error.id);
  expect(confirmation.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(confirmation);
  expect(m.verify).not.toHaveBeenCalled();
  fireEvent.change(confirmation, { target: { value: "Test-password-2026" } });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(confirmation.hasAttribute("aria-invalid")).toBe(false);
  fireEvent.click(submit);
  expect((await screen.findByRole("status")).textContent).toMatch(/Mot de passe modifié/);
});

it.each([
  { stage: "verification", status: 403, expected: "Ce lien est invalide ou expiré." },
  { stage: "verification", status: 0, expected: "La modification n’a pas abouti." },
  { stage: "verification", status: 429, expected: "La modification n’a pas abouti." },
  { stage: "verification", status: 503, expected: "La modification n’a pas abouti." },
  { stage: "staff lookup", status: 503, expected: "La modification n’a pas abouti." },
  { stage: "update", status: 500, expected: "La modification n’a pas abouti." },
])("provides a single focused alert and a new-link action after $stage failure ($status)", async ({ stage, status, expected }) => {
  const { StaffRecoveryReset } = await import(".");
  window.history.replaceState(null, "", "/reinitialiser#token_hash=" + token);
  if (stage === "verification") m.verify.mockResolvedValueOnce({ error: { status }, data: { session: null } });
  if (stage === "staff lookup") m.staff.mockResolvedValueOnce({ error: { status }, data: null });
  if (stage === "update") m.update.mockResolvedValueOnce({ error: { status } });
  render(<MemoryRouter><StaffRecoveryReset /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "Test-password-2026" } });
  fireEvent.change(screen.getByLabelText("Confirme le mot de passe"), { target: { value: "Test-password-2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Modifier le mot de passe" }));
  const error = await screen.findByRole("alert");
  expect(error.textContent?.trim()).toBe(expected);
  expect(document.activeElement).toBe(error);
  const retry = screen.getByRole("link", { name: "Demander un nouveau lien" });
  expect(retry.getAttribute("href")).toBe("/mot-de-passe-oublie");
  expect(error.contains(retry)).toBe(false);
  expect(screen.queryByText(/Choisis un mot de passe/)).toBeNull();
  expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  if (stage !== "update") expect(m.update).not.toHaveBeenCalled();
});
