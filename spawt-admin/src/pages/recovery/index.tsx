import { useEffect, useState } from "react";
import { Link } from "react-router";
import { createStaffRecoveryClient } from "../../utility/supabaseClient";

export const staffRecoveryEnabled = import.meta.env.VITE_STAFF_RECOVERY_ENABLED === "true";
const resetPath = "/reinitialiser";
const tokenPattern = /^(?:pkce_)?(?:[a-f\d]{56}|[a-f\d]{64})$/i;

export function staffRecoveryToken(fragment: string) {
  const p = new URLSearchParams(fragment.replace(/^#/, ""));
  const t = p.get("token_hash");
  return p.getAll("token_hash").length === 1 && t && tokenPattern.test(t) ? t : "";
}

export function StaffRecoveryRequest() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <main className="panel" style={{margin:"10vh auto",maxWidth:440,padding:24}}>
    <h1>Mot de passe oublié</h1>
    {!staffRecoveryEnabled ? <p>La récupération n’est pas encore disponible.</p> : sent ?
      <p role="status">Si cette adresse est associée à un compte, un lien de réinitialisation va être envoyé. Pense à vérifier les indésirables.</p> :
      <form onSubmit={async e => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);setFailed(false);
        const email=String(new FormData(e.currentTarget).get("email")??"").trim();
        try {
          const {error}=await createStaffRecoveryClient().auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin+resetPath,
          });
          if (error && (error.status === 429 || (error.status ?? 0) >= 500)) setFailed(true);
          else setSent(true);
        } catch { setFailed(true); }
        finally {setBusy(false);}
      }}>
        <label>Adresse e-mail <input required type="email" name="email" autoComplete="email" maxLength={254}/></label>
        <button type="submit" className="btn-primary" disabled={busy}>Envoyer le lien</button>
        {failed && <p role="alert">Le service est indisponible pour le moment. Réessaie dans quelques minutes.</p>}
      </form>}
    <p><Link to="/login" replace>Retour à la connexion</Link></p>
  </main>;
}

export function StaffRecoveryReset() {
  const [token] = useState(()=>staffRecoveryToken(window.location.hash));
  useEffect(()=>{if(window.location.hash) window.history.replaceState(window.history.state,"",window.location.pathname);},[]);
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [invalid,setInvalid]=useState(!token);
  const [error,setError]=useState("");
  return <main className="panel" style={{margin:"10vh auto",maxWidth:440,padding:24}}>
    <h1>Nouveau mot de passe</h1>
    {!staffRecoveryEnabled ? <p>La récupération n’est pas encore disponible.</p> : done ?
      <p role="status">Mot de passe modifié. Tu peux te reconnecter.</p> : invalid ?
      <p role="alert">Ce lien est invalide ou expiré. <Link replace to="/mot-de-passe-oublie">Demander un nouveau lien</Link>.</p> :
      <form onSubmit={async e=>{
        e.preventDefault();
        if(busy) return;
        const f=new FormData(e.currentTarget);
        const password=String(f.get("password")??"");
        if(password.length<12 || password!==f.get("confirmation")) {
          setError("Saisis deux mots de passe identiques d’au moins 12 caractères.");return;
        }
        setBusy(true);setError("");
        const c=createStaffRecoveryClient();
        try {
          const v=await c.auth.verifyOtp({type:"recovery",token_hash:token});
          if(v.error || !v.data.session) {setInvalid(true);return;}
          const staff=await c.rpc("current_staff").maybeSingle();
          if(staff.error || !staff.data) {setInvalid(true);return;}
          const change=await c.auth.updateUser({password});
          if(change.error) {
            setInvalid(true);
            setError("La modification a échoué. Demande un nouveau lien, puis choisis un autre mot de passe.");
            return;
          }
          setDone(true);
          await c.auth.signOut({scope:"global"}).catch(()=>undefined);
        } catch {
          setInvalid(true);setError("La demande n’a pas abouti. Demande un nouveau lien.");
        } finally {
          await c.auth.signOut({scope:"local"}).catch(()=>undefined);
          setBusy(false);
        }
      }}>
        <p>Choisis un mot de passe unique d’au moins 12 caractères.</p>
        <p><label>Nouveau mot de passe <input type="password" name="password" required minLength={12} maxLength={72} autoComplete="new-password"/></label></p>
        <p><label>Confirme le mot de passe <input type="password" name="confirmation" required minLength={12} maxLength={72} autoComplete="new-password"/></label></p>
        <button type="submit" className="btn-primary" disabled={busy}>Modifier le mot de passe</button>
      </form>}
    {error && <p role="alert">{error}</p>}
    <p><Link to="/login" replace>Retour à la connexion</Link></p>
  </main>;
}
