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
it("changes the password only for an active staff member and revokes recovery sessions",async()=>{
 const {StaffRecoveryReset}=await import(".");
 window.history.replaceState(null,"","/reinitialiser#token_hash="+token);
 render(<MemoryRouter><StaffRecoveryReset/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText("Nouveau mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.change(screen.getByLabelText("Confirme le mot de passe"),{target:{value:"Test-password-2026"}});
 fireEvent.click(screen.getByRole("button",{name:"Modifier le mot de passe"}));
 expect((await screen.findByRole("status")).textContent).toMatch(/Mot de passe modifié/);
 expect(m.update).toHaveBeenCalledWith({password:"Test-password-2026"});
 expect(m.signOut).toHaveBeenCalledWith({scope:"global"});
});
