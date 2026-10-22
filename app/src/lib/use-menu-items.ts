import { useEffect, useState } from "react";
import { listMenuItems, type MenuItem } from "./outings";
import { useContentRevision } from "./content-sync";
export function useMenuItems(placeId?: string) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const revision = useContentRevision();
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    void listMenuItems(placeId).then(data => { if (active) setItems(data); })
      .catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [placeId, revision, attempt]);
  return { items, failed, loading, reload: () => setAttempt(a => a + 1) };
}
export function findMenuItems(items: readonly MenuItem[], query: string): MenuItem[] {
  const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items.filter(item => {
    const haystack = normalized([item.name, ...(item.aliases ?? []), ...(item.accompaniments ?? [])].join(" "));
    return words.every(word => haystack.includes(word));
  });
}
