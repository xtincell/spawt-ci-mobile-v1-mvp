import { createContext, useState, useEffect, useCallback } from "react";
import { findArchetype, getStage, getStageIndex, getTitle, getPalaisLabel } from "../data/archetypes";
import { checkBadges } from "../data/badges";

const STORAGE_KEY = "spawt_user";
const COMMUNITY_MENU_KEY = "spawt_community_menu";

const DEFAULT_USER = {
  name: "Kouadio Amara",
  username: "@amara_k",
  memberSince: "Fév 2026",

  palais: {
    racinesHorizons: 0,
    taniereNomade: 0,
    exigeantEnthousiaste: 0,
    fouleSecret: 0,
    gargoteTable: 0,
  },

  stade: "chaton",
  spotsCount: 0,
  archetype: null,
  currentTitle: "Chaton",
  displayedTitle: "Chaton",
  titleCollection: [],

  spawts: [],
  coupsDeCoeur: { used: 0, available: 1 },
  badges: [],

  // Marquage — spots ciblés "à tester"
  markedSpots: [],

  // Sur place — timer-based check-in alternative to geoloc
  // { spotId, startedAt (ISO string) } or null
  onSite: null,

  onboarded: false,
};

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults for new fields
        return { ...DEFAULT_USER, ...parsed };
      }
    } catch {}
    return { ...DEFAULT_USER };
  });

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  // Complete onboarding with palais values
  const completeOnboarding = useCallback((palaisValues) => {
    setUser(prev => {
      const palais = { ...palaisValues };
      const archetype = findArchetype(palais, 0);
      const title = archetype.stages[0];
      return {
        ...prev,
        palais,
        onboarded: true,
        archetype: archetype.id,
        currentTitle: title,
        displayedTitle: title,
        titleCollection: [{ name: title, archetype: archetype.id, stage: 0, earnedAt: "Fév 2026" }],
      };
    });
  }, []);

  // ── MARQUAGE 📌 ──────────────────────────────
  const toggleMarkSpot = useCallback((spotId) => {
    setUser(prev => {
      const already = (prev.markedSpots || []).includes(spotId);
      return {
        ...prev,
        markedSpots: already
          ? prev.markedSpots.filter(id => id !== spotId)
          : [...(prev.markedSpots || []), spotId],
      };
    });
  }, []);

  const isSpotMarked = useCallback((spotId) => {
    return (user.markedSpots || []).includes(spotId);
  }, [user.markedSpots]);

  // ── SUR PLACE ⏱ ─────────────────────────────
  // Alternative au GPS : l'utilisateur déclare être sur place
  // Après 30 min, on suggère de noter
  const setOnSite = useCallback((spotId) => {
    setUser(prev => ({
      ...prev,
      onSite: { spotId, startedAt: new Date().toISOString() },
    }));
  }, []);

  const clearOnSite = useCallback(() => {
    setUser(prev => ({ ...prev, onSite: null }));
  }, []);

  // Vérifie si l'utilisateur est "sur place" depuis assez longtemps pour noter
  const getOnSiteStatus = useCallback(() => {
    if (!user.onSite) return null;
    const elapsed = Date.now() - new Date(user.onSite.startedAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    return {
      spotId: user.onSite.spotId,
      minutes,
      readyToRate: minutes >= 20, // 20 min minimum pour un repas rapide
    };
  }, [user.onSite]);

  // ── COMMUNITY MENU 🍽 ─────────────────────────
  // Certified spawts contribute dishes to the community menu
  const addToCommunityMenu = useCallback((spotId, plats) => {
    try {
      const stored = JSON.parse(localStorage.getItem(COMMUNITY_MENU_KEY) || "{}");
      const menu = stored[spotId] || [];

      for (const plat of plats) {
        if (!plat.rating || !plat.nom) continue;
        const existing = menu.find(m => m.nom.toLowerCase() === plat.nom.toLowerCase());
        if (existing) {
          existing.totalRating += plat.rating;
          existing.count += 1;
        } else {
          menu.push({ nom: plat.nom, totalRating: plat.rating, count: 1 });
        }
      }

      stored[spotId] = menu;
      localStorage.setItem(COMMUNITY_MENU_KEY, JSON.stringify(stored));
    } catch {}
  }, []);

  const getCommunityMenu = useCallback((spotId) => {
    try {
      const stored = JSON.parse(localStorage.getItem(COMMUNITY_MENU_KEY) || "{}");
      return (stored[spotId] || []).map(m => ({
        nom: m.nom,
        avgRating: Math.round((m.totalRating / m.count) * 10) / 10,
        count: m.count,
      }));
    } catch { return []; }
  }, []);

  // ── SPAWT (check-in + notation) ──────────────
  // rating obligatoire (1-5), review + plats optionnels
  // certified = GPS (<150m) ou sur place (>=20min)
  const spawtSpot = useCallback((spotId, spotAdn, { rating, review, plats, certified } = {}) => {
    setUser(prev => {
      // Update palais: convergence lente vers le lieu
      const newPalais = { ...prev.palais };
      for (const axe of Object.keys(newPalais)) {
        if (spotAdn[axe] !== undefined) {
          // Bonus d'évolution si l'utilisateur note des plats
          const convergenceFactor = plats && plats.length > 0 ? 0.14 : 0.1;
          newPalais[axe] += (spotAdn[axe] - newPalais[axe]) * convergenceFactor;
          newPalais[axe] = Math.round(newPalais[axe] * 10) / 10;
        }
      }

      // spotsCount = nombre de spots UNIQUES visités
      const isFirstVisit = !prev.spawts.some(s => s.spotId === spotId);
      const newSpotsCount = isFirstVisit ? prev.spotsCount + 1 : prev.spotsCount;

      const spawtEntry = {
        id: `spawt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        spotId,
        date: new Date().toISOString(),
      };
      if (rating) spawtEntry.rating = rating;
      if (review) spawtEntry.review = review;
      if (plats && plats.length > 0) spawtEntry.plats = plats;
      if (certified) spawtEntry.certified = true;
      const newSpawts = [...prev.spawts, spawtEntry];

      // Recalculate archetype + title
      const archetype = findArchetype(newPalais, newSpotsCount);
      const stageObj = getStage(newSpotsCount);
      const stageIdx = getStageIndex(newSpotsCount);
      const newTitle = archetype.stages[stageIdx];

      // Check if title changed -> add to collection
      const titleCollection = [...prev.titleCollection];
      if (newTitle !== prev.currentTitle) {
        const alreadyHas = titleCollection.some(t => t.name === newTitle);
        if (!alreadyHas) {
          titleCollection.push({
            name: newTitle,
            archetype: archetype.id,
            stage: stageIdx,
            earnedAt: new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
          });
        }
      }

      // Check for new badges
      const tempUser = { ...prev, spotsCount: newSpotsCount, badges: prev.badges };
      const newBadges = checkBadges(tempUser);
      const allBadges = [...prev.badges, ...newBadges.map(b => ({
        id: b.id, name: b.name, icon: b.icon,
        dateEarned: new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
      }))];

      // Update coups de coeur availability based on stage
      const coupsDispo = stageIdx <= 1 ? 1 : stageIdx === 2 ? 2 : stageIdx === 3 ? 3 : 5;

      // Auto-retirer des spots marqués quand on spawte
      const newMarkedSpots = (prev.markedSpots || []).filter(id => id !== spotId);

      // Effacer onSite si c'est le spot spawté
      const newOnSite = prev.onSite && prev.onSite.spotId === spotId ? null : prev.onSite;

      return {
        ...prev,
        palais: newPalais,
        spotsCount: newSpotsCount,
        spawts: newSpawts,
        archetype: archetype.id,
        stade: stageObj.id,
        currentTitle: newTitle,
        displayedTitle: prev.displayedTitle === prev.currentTitle ? newTitle : prev.displayedTitle,
        titleCollection,
        badges: allBadges,
        coupsDeCoeur: { ...prev.coupsDeCoeur, available: coupsDispo },
        markedSpots: newMarkedSpots,
        onSite: newOnSite,
      };
    });

    // Certified spawts contribute to community menu
    if (certified && plats && plats.length > 0) {
      setTimeout(() => addToCommunityMenu(spotId, plats), 0);
    }
  }, [addToCommunityMenu]);

  // Add a review to an existing spawt
  const addReview = useCallback((spotId, rating, text) => {
    setUser(prev => {
      const updatedSpawts = prev.spawts.map(s =>
        s.spotId === spotId && !s.rating
          ? { ...s, rating, review: text }
          : s
      );
      return { ...prev, spawts: updatedSpawts };
    });
  }, []);

  // ── EDIT SPAWT ✏️ ─────────────────────────────
  const editSpawt = useCallback((spawtId, updates) => {
    setUser(prev => {
      const updatedSpawts = prev.spawts.map(s =>
        s.id === spawtId
          ? { ...s, ...updates, lastEditedAt: new Date().toISOString() }
          : s
      );
      return { ...prev, spawts: updatedSpawts };
    });
  }, []);

  // Use a coup de coeur
  const useCoupDeCoeur = useCallback((spotId) => {
    setUser(prev => {
      if (prev.coupsDeCoeur.used >= prev.coupsDeCoeur.available) return prev;
      return {
        ...prev,
        coupsDeCoeur: {
          ...prev.coupsDeCoeur,
          used: prev.coupsDeCoeur.used + 1,
        },
      };
    });
  }, []);

  // Change displayed title
  const changeDisplayedTitle = useCallback((titleName) => {
    setUser(prev => ({ ...prev, displayedTitle: titleName }));
  }, []);

  // Reset user (dev helper)
  const resetUser = useCallback(() => {
    setUser({ ...DEFAULT_USER });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = {
    user,
    completeOnboarding,
    spawtSpot,
    addReview,
    editSpawt,
    useCoupDeCoeur,
    changeDisplayedTitle,
    resetUser,
    // Marquage
    toggleMarkSpot,
    isSpotMarked,
    // Sur place
    setOnSite,
    clearOnSite,
    getOnSiteStatus,
    // Community menu
    addToCommunityMenu,
    getCommunityMenu,
    // Computed helpers
    palaisLabel: getPalaisLabel(user.palais),
    stage: getStage(user.spotsCount),
    stageIndex: getStageIndex(user.spotsCount),
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
