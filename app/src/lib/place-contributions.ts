import { Platform } from "react-native";
import { supabase } from "./supabase";
import { isSupabaseConfigured } from "./data-source";
import { withReadTimeout } from "./data-read-error";
import { readUploadBody } from "./upload-body";
import { CONTRIBUTION_BUCKET, contributionMenuPath, type ContributionKind, type PlaceContribution } from "../../../shared/place-contributions";
export { preciseRecentLocation } from "../../../shared/place-contributions";
export type { ContributionKind, PlaceContribution, LocationProof } from "../../../shared/place-contributions";

export async function listContributions(owner: string, place: string) {
  if (!isSupabaseConfigured) throw new Error("backend_unconfigured");
  const { data, error } = await withReadTimeout("contributions", signal => supabase.from("place_contributions")
    .select("*").eq("spawter_id", owner).eq("place_id", place).order("created_at", { ascending: false }).limit(50).abortSignal(signal));
  if (error) throw error;
  return (data ?? []) as PlaceContribution[];
}
export async function contributionRewards(): Promise<Record<ContributionKind, number>> {
  if (!isSupabaseConfigured) throw new Error("backend_unconfigured");
  const { data, error } = await withReadTimeout("contribution_rules", signal => supabase.from("place_contribution_rules").select("kind,reward_paws").abortSignal(signal));
  if (error || data?.length !== 2) throw error ?? new Error("rules_unavailable");
  return Object.fromEntries(data.map(r => [r.kind, r.reward_paws])) as Record<ContributionKind, number>;
}
/** Keep a selected photo after a native process restart; never upload a thumbnail. */
export async function persistContributionPhoto(uri: string, name: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  const { File, Directory, Paths } = await import("expo-file-system");
  const directory = new Directory(Paths.document, "contribution-drafts");
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, `${name}.jpg`);
  new File(uri).copy(target);
  return target.uri;
}
export async function uploadContributionPhoto(uri: string, owner: string, id: string, index: number): Promise<string> {
  const path = `${owner}/${id}/${index}.jpg`;
  const body = await readUploadBody(uri);
  if (!body.byteLength || body.byteLength > 5 * 1024 * 1024) throw new Error("photo_size");
  const { error } = await withReadTimeout("contribution_upload", () => supabase.storage.from(CONTRIBUTION_BUCKET)
    .upload(path, body, { contentType: "image/jpeg", upsert: false }));
  // Immutable paths + stable draft ID: a lost upload response can be retried.
  if (error && !("statusCode" in error && String(error.statusCode) === "409")) throw error;
  return path;
}
export async function submitContribution(id: string, place: string, kind: ContributionKind, proposal: PlaceContribution["proposal"], comment: string) {
  if (!isSupabaseConfigured) throw new Error("backend_unconfigured");
  const { data, error } = await withReadTimeout("contribution_send", signal => supabase.rpc("submit_place_contribution", {
    p_id: id, p_place_id: place, p_kind: kind, p_proposal: proposal, p_comment: comment.trim(),
  }).abortSignal(signal));
  if (error || typeof data !== "string") throw error ?? new Error("missing_receipt");
  return data;
}
export async function resolveMenuUrls(urls: readonly string[]): Promise<string[]> {
  const paths = urls.map(contributionMenuPath).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await withReadTimeout("menu_photos", () => supabase.storage.from(CONTRIBUTION_BUCKET).createSignedUrls(paths, 3600));
    if (error) throw error;
    for (const row of data ?? []) if (row.path && row.signedUrl && !row.error) signed.set(row.path, row.signedUrl);
    if (signed.size !== new Set(paths).size) throw new Error("menu_unavailable");
  }
  return urls.flatMap(url => {
    if (/^https?:\/\//i.test(url)) return [url];
    const path = contributionMenuPath(url); return path && signed.has(path) ? [signed.get(path)!] : [];
  });
}
