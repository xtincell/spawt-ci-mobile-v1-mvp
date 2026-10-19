import { useEffect, useMemo, useState, type SetStateAction } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** A changed storage key hides the old value immediately, before effects run.
 * A late read or updater from another account can never overwrite this draft. */
export function useOwnedDraft<T>(key: string, create: () => T, validate: (value: unknown) => value is T) {
  const empty = useMemo(create, [key, create]);
  const [state, setState] = useState<{ key: string | null; value: T }>({ key: null, value: empty });
  const ready = state.key === key;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key).then(raw => {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (active) setState({ key, value: validate(parsed) ? parsed : empty });
    }).catch(() => { if (active) setState({ key, value: empty }); });
    return () => { active = false; };
  }, [key, empty, validate]);
  useEffect(() => {
    if (ready) void AsyncStorage.setItem(key, JSON.stringify(state.value)).catch(() => {});
  }, [key, ready, state.value]);
  const setDraft = (next: SetStateAction<T>) => setState(previous => previous.key !== key ? previous : {
    key, value: typeof next === "function" ? (next as (value: T) => T)(previous.value) : next,
  });
  return { draft: ready ? state.value : empty, setDraft, ready };
}
