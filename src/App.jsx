import { useState, useCallback } from "react";
import { COLORS } from "./theme";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import useUser from "./hooks/useUser";
import BottomNav from "./components/BottomNav";
import SpawSheet from "./components/SpawSheet";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import SpotDetail from "./pages/SpotDetail";
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";

function AppRoutes() {
  const { user } = useUser();
  const [spawSheetOpen, setSpawSheetOpen] = useState(false);
  const [spawSheetSpotId, setSpawSheetSpotId] = useState(null);

  const openSpawSheet = useCallback(() => {
    setSpawSheetSpotId(null);
    setSpawSheetOpen(true);
  }, []);

  const openSpawSheetWithSpot = useCallback((spotId) => {
    setSpawSheetSpotId(spotId);
    setSpawSheetOpen(true);
  }, []);

  const closeSpawSheet = useCallback(() => {
    setSpawSheetOpen(false);
    setSpawSheetSpotId(null);
  }, []);

  if (!user.onboarded) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home onSpawtDirect={openSpawSheetWithSpot} />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/spot/:id" element={<SpotDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/onboarding" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav onSpawtTap={openSpawSheet} />
      <SpawSheet open={spawSheetOpen} onClose={closeSpawSheet} preSelectedSpotId={spawSheetSpotId} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <div style={{
          maxWidth: 430,
          margin: "0 auto",
          minHeight: "100vh",
          position: "relative",
          background: COLORS.white,
        }}>
          <AppRoutes />
        </div>
      </UserProvider>
    </BrowserRouter>
  );
}
