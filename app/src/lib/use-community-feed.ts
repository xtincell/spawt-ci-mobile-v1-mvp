import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { listCommunityPage, type MeuteActivityItem } from "./data-source";
import { subscribeReviewChanges } from "./review-events";
import {
  mergeCommunity,
  type CommunityCursor,
  type CommunityFilter,
} from "./community";

export function useCommunityFeed() {
  const [filter, setFilter] = useState<CommunityFilter>("all");
  const [items, setItems] = useState<MeuteActivityItem[]>([]);
  const [next, setNext] = useState<CommunityCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);

  const load = useCallback(
    async (cursor: CommunityCursor | null = null) => {
      // Synchronous lock, including repeated end-of-list / double presses.
      if (cursor && busy.current) return;
      const current = ++request.current;
      busy.current = true;
      if (cursor) {
        setMore(true);
        setMoreFailed(false);
      } else {
        setLoading(true);
        setFailed(false);
        setMore(false);
        setMoreFailed(false);
      }
      try {
        const page = await listCommunityPage({ filter, cursor });
        if (current !== request.current) return;
        setItems((previous) =>
          cursor ? mergeCommunity(previous, page.items) : page.items
        );
        setNext(page.next);
      } catch {
        if (current === request.current) {
          if (cursor) setMoreFailed(true);
          else setFailed(true);
        }
      } finally {
        if (current === request.current) {
          busy.current = false;
          setLoading(false);
          setMore(false);
        }
      }
    },
    [filter]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const unsubscribe = subscribeReviewChanges(() => void load());
      return () => {
        unsubscribe();
        request.current++;
        busy.current = false;
      };
    }, [load])
  );

  const selectFilter = (value: CommunityFilter) => {
    if (filter === value) return;
    request.current++;
    setItems([]);
    setNext(null);
    setLoading(true);
    setFailed(false);
    setMoreFailed(false);
    setFilter(value);
  };
  return {
    items,
    filter,
    selectFilter,
    loading,
    more,
    failed,
    moreFailed,
    hasMore: next !== null,
    refresh: () => void load(),
    loadMore: () => {
      if (next) void load(next);
    },
  };
}
