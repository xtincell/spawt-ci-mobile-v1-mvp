import { withReadTimeout } from "./data-read-error";
import { supabase } from "./supabase";

const validScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

async function userToken(owner: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== owner) throw new Error("rating_session_changed");
  return session.access_token;
}

export async function readMenuItemRating(owner: string, dish: string): Promise<number | null> {
  const token = await userToken(owner);
  const { data, error } = await withReadTimeout("menu_item_ratings", signal =>
    supabase.rpc("my_menu_item_ratings").setHeader("Authorization", "Bearer " + token).abortSignal(signal));
  if (error || !Array.isArray(data)) throw new Error("rating_read_failed");
  const row = data.find((item: { menu_item_id: string }) => item.menu_item_id === dish);
  if (!row) return null;
  if (!validScore(row.rating)) throw new Error("rating_value_invalid");
  return row.rating;
}

export async function writeMenuItemRating(owner: string, dish: string, value: number | null): Promise<void> {
  if (value !== null && !validScore(value)) throw new Error("rating_value_invalid");
  const token = await userToken(owner);
  const { data, error } = await withReadTimeout("menu_item_rating_write", signal =>
    supabase.rpc("set_menu_item_rating", { p_menu_item_id: dish, p_rating: value })
      .setHeader("Authorization", "Bearer " + token).abortSignal(signal));
  if (error || data !== value) throw new Error("rating_unconfirmed");
}
