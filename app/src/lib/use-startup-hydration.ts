import { useCallback, useEffect, useState } from "react";

/** Une erreur de stockage laisse le compte intact et permet une nouvelle lecture. */
export function useStartupHydration(restore: () => Promise<void>) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void restore().catch((error: unknown) => {
      if (!active) return;
      if (__DEV__) console.warn("[startup] account restore failed", error);
      setFailed(true);
    });
    return () => { active = false; };
  }, [restore, attempt]);

  return { failed, retry };
}
