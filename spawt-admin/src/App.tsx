import { Refine } from "@refinedev/core";
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
import { ComptesList } from "./pages/comptes";
import { CompteShow } from "./pages/comptes/show";
import { MetriquesDashboard } from "./pages/metriques";

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
        { name: "spawt_checkin", list: "/moderation", meta: { label: "Modération" } },
        {
          name: "spawters",
          list: "/comptes",
          show: "/comptes/show/:id",
          meta: { label: "Comptes" },
        },
        { name: "metriques", list: "/metriques", meta: { label: "Métriques" } },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/lieux" replace />} />
          <Route path="/lieux" element={<LieuxList />} />
          <Route path="/lieux/create" element={<LieuCreate />} />
          <Route path="/lieux/edit/:id" element={<LieuEdit />} />
          <Route path="/moderation" element={<ModerationList />} />
          <Route path="/comptes" element={<ComptesList />} />
          <Route path="/comptes/show/:id" element={<CompteShow />} />
          <Route path="/metriques" element={<MetriquesDashboard />} />
        </Route>
      </Routes>
    </Refine>
  </BrowserRouter>
);
