import { Outlet, NavLink } from "react-router";
import { useGetIdentity, useLogout } from "@refinedev/core";

interface StaffIdentity {
  id: string;
  display_name: string;
  email: string;
  role: "admin" | "moderator" | "operator";
}

export const Layout = () => {
  const { data: identity } = useGetIdentity<StaffIdentity>();
  const { mutate: logout } = useLogout();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>SPAWT admin</h1>
        <nav>
          <NavLink to="/lieux" className={({ isActive }) => (isActive ? "active" : "")}>
            Lieux
          </NavLink>
          <NavLink to="/moderation" className={({ isActive }) => (isActive ? "active" : "")}>
            Modération
          </NavLink>
          <NavLink to="/comptes" className={({ isActive }) => (isActive ? "active" : "")}>
            Comptes
          </NavLink>
          <NavLink to="/metriques" className={({ isActive }) => (isActive ? "active" : "")}>
            Métriques
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            {identity ? (
              <>
                <strong>{identity.display_name}</strong>
                <span className="role-badge">{identity.role}</span>
              </>
            ) : (
              "—"
            )}
          </div>
          <button type="button" onClick={() => logout()}>
            Déconnexion
          </button>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
      <div className="viewport-warning">
        Le panel SPAWT admin est optimisé pour un écran ≥ 1024px.
      </div>
    </div>
  );
};
