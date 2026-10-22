import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/** One navigation per focus cycle; returning from a detail unlocks the source. */
export function useNavigationAction() {
  const pending = useRef(false);
  useFocusEffect(
    useCallback(() => {
      pending.current = false;
    }, []),
  );
  return useCallback((action: () => void) => {
    if (pending.current) return;
    pending.current = true;
    try {
      action();
    } catch (error) {
      pending.current = false;
      throw error;
    }
  }, []);
}
