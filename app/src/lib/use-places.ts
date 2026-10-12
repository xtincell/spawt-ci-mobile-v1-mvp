import { useCallback, useEffect, useRef, useState } from "react";
import { listPlaces, type PlaceWithAdn } from "./data-source";

/** A failed refresh keeps the last readable inventory; it never invents an empty one. */
export function usePlaces(enabled = true) {
  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const reload = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const data = await listPlaces();
      if (request.current === current) setPlaces(data);
    } catch {
      if (request.current === current) setFailed(true);
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
    else setLoading(false);
    return () => { request.current += 1; };
  }, [enabled, reload]);

  return { places, loading, failed, reload };
}
