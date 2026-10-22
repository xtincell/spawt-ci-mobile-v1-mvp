import type { MeuteActivityItem } from "./data-source";

export type CommunityFilter = "all" | "review" | "coup";
export interface CommunityCursor {
  created_at: string;
  id: string;
}
export interface CommunityPage {
  items: MeuteActivityItem[];
  next: CommunityCursor | null;
}
export interface CommunityQuery {
  filter?: CommunityFilter;
  cursor?: CommunityCursor | null;
  limit?: number;
}

/** One chronological stream, never a fixed quota per source. */
export function communityPage(
  items: MeuteActivityItem[],
  limit: number
): CommunityPage {
  const ordered = [...items].sort((a, b) => {
    const time = Date.parse(b.created_at) - Date.parse(a.created_at);
    return time || b.id.localeCompare(a.id);
  });
  const visible = ordered.slice(0, limit);
  const last = visible.at(-1);
  return {
    items: visible,
    next:
      ordered.length > limit && last
        ? { created_at: last.created_at, id: last.id }
        : null,
  };
}

export function mergeCommunity(
  items: MeuteActivityItem[],
  incoming: MeuteActivityItem[]
) {
  const byId = new Map(items.map((item) => [`${item.kind}:${item.id}`, item]));
  incoming.forEach((item) => byId.set(`${item.kind}:${item.id}`, item));
  return [...byId.values()];
}
