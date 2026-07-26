import { Authenticated, Refine } from "@refinedev/core";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Route, Routes, Navigate } from "react-router";

import { supabaseClient } from "./utility/supabaseClient";
import { authProvider } from "./providers/authProvider";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/login";
import { LieuxList } from "./pages/lieux";
import { LieuCreate } from "./pages/lieux/create";
import { LieuEdit } from "./pages/lieux/edit";
import { ModerationList } from "./pages/moderation";
import { SignalementsList } from "./pages/signalements";
import { ComptesList } from "./pages/comptes";
import { CompteShow } from "./pages/comptes/show";
import { MetriquesDashboard } from "./pages/metriques";
import { FonctionnalitesList } from "./pages/fonctionnalites";
// Console admin complète 07/2026
import { EvenementsList } from "./pages/evenements";
import { PromotionsList } from "./pages/promotions";
import { DefisList } from "./pages/defis";
import { SuggestionsList } from "./pages/suggestions";
import { B2bList } from "./pages/b2b";
import { PushCampaigns } from "./pages/push";
import { ExploreCuration } from "./pages/explore";

// CR Chunk B C6 — Guard d'auth wrapper. Refine v5 `<Authenticated>` redirige
// vers `/login` si l'utilisateur n'est pas authentifié OU si le check()
// retourne false (staff inactif / désactivé). Wrap toutes les routes protégées
// pour bloquer le bypass UX (sidebar + topbar rendus sans session sinon).
// Layout possède son propre <Outlet /> donc on n'a pas besoin de l'injecter.
const ProtectedLayout = () => (
  <Authenticated key="admin-protected" fallback={<Navigate to="/login" replace />}>
    <Layout />
  </Authenticated>
);

export const App = () => (
  <BrowserRouter>
    <Refine
      dataProvider={dataProvider(supabaseClient)}
      liveProvider={liveProvider(supabaseClient)}
      authProvider={authProvider}
      routerProvider={routerProvider}
      resources={[
        {
          name: "places",
          list: "/lieux",
          create: "/lieux/create",
          edit: "/lieux/edit/:id",
          meta: { label: "Lieux" },
        },
        // CR Chunk B m12 — déclare place_adn comme resource (PlaceForm utilise
        // useCreate/useUpdate sur cette resource, sinon warn Refine). Refine v5
        // n'a pas de notion native de "child" — on déclare juste un meta.hide
        // pour ne pas l'afficher dans la sidebar.
        {
          name: "place_adn",
          meta: { label: "ADN lieu", hide: true },
        },
        { name: "spawt_checkin", list: "/moderation", meta: { label: "Modération" } },
      { name: "review_reports", list: "/signalements", meta: { label: "Signalements" } },
        {
          name: "spawters",
          list: "/comptes",
          show: "/comptes/show/:id",
          meta: { label: "Comptes" },
        },
        { name: "metriques", list: "/metriques", meta: { label: "Métriques" } },
        // MAJ consolidée 07/2026 — page Fonctionnalités (feature flags produit).
        // Query directe Supabase comme metriques ; la resource n'existe que
        // pour la cohérence menu/breadcrumb Refine.
        { name: "feature_flags", list: "/fonctionnalites", meta: { label: "Fonctionnalités" } },
        // Console admin complète 07/2026 — événements/promos/défis/suggestions/
        // B2B/push/Explore. Les pages en query directe Supabase déclarent la
        // resource pour la cohérence menu/breadcrumb ; suggestions passe par
        // useTable (dataProvider).
        { name: "place_events", list: "/evenements", meta: { label: "Événements" } },
        { name: "place_promotions", list: "/promotions", meta: { label: "Promotions" } },
        { name: "challenges", list: "/defis", meta: { label: "Défis" } },
        { name: "place_suggestions", list: "/suggestions", meta: { label: "Suggestions" } },
        { name: "b2b_accounts", list: "/b2b", meta: { label: "Comptes B2B" } },
        { name: "push_campaigns", list: "/push", meta: { label: "Push" } },
        { name: "explore_collections", list: "/explore", meta: { label: "Explore" } },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/lieux" replace />} />
          <Route path="/lieux" element={<LieuxList />} />
          <Route path="/lieux/create" element={<LieuCreate />} />
          <Route path="/lieux/edit/:id" element={<LieuEdit />} />
          <Route path="/moderation" element={<ModerationList />} />
          <Route path="/signalements" element={<SignalementsList />} />
          <Route path="/comptes" element={<ComptesList />} />
          <Route path="/comptes/show/:id" element={<CompteShow />} />
          <Route path="/metriques" element={<MetriquesDashboard />} />
          <Route path="/fonctionnalites" element={<FonctionnalitesList />} />
          <Route path="/evenements" element={<EvenementsList />} />
          <Route path="/promotions" element={<PromotionsList />} />
          <Route path="/defis" element={<DefisList />} />
          <Route path="/suggestions" element={<SuggestionsList />} />
          <Route path="/b2b" element={<B2bList />} />
          <Route path="/push" element={<PushCampaigns />} />
          <Route path="/explore" element={<ExploreCuration />} />
        </Route>
      </Routes>
    </Refine>
  </BrowserRouter>
);
