// Console admin 07/2026 — hook partagé : liste des lieux pour les selects
// (pages Événements, Promotions, B2B, Explore). Lecture staff (policy 0018),
// une seule requête par montage de page — l'inventaire V1 tient largement
// en mémoire (« Sprint 2 : pagination server-side si > 1000 lieux »).

import { useEffect, useState } from "react";
import { supabaseClient } from "../utility/supabaseClient";

export interface PlaceOption {
  id: string;
  name: string;
  neighborhood: string | null;
  is_published: boolean;
}

export function usePlaces(): {
  places: PlaceOption[];
  loading: boolean;
  error: string | null;
} {
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await supabaseClient
        .from("places")
        .select("id, name, neighborhood, is_published")
        .order("name", { ascending: true })
        .limit(2000);
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setPlaces((data ?? []) as PlaceOption[]);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { places, loading, error };
}

/** Libellé d'un lieu dans les selects : « Nom (quartier) ». */
export function placeLabel(p: Pick<PlaceOption, "name" | "neighborhood">): string {
  return p.neighborhood ? `${p.name} (${p.neighborhood})` : p.name;
}
