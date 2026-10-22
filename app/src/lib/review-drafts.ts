import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { isStarRating, type StarRating } from "./review-ratings";
import { REVIEW_TAGS, type ReviewTag } from "../types/spawt";

export interface ReviewDraft {
  placeName?: string;
  note_cuisine: StarRating | null;
  note_cadre: StarRating | null;
  note_service: StarRating | null;
  tags: ReviewTag[];
  text: string;
  photoUris: string[];
}

function draftKey(owner: string, spawtId: string): string {
  return `spawt:review-draft:${owner}:${spawtId}`;
}

export async function loadReviewDraft(owner: string, spawtId: string): Promise<ReviewDraft | null> {
  const raw = await AsyncStorage.getItem(draftKey(owner, spawtId));
  if (!raw) return null;
  const d = JSON.parse(raw) as ReviewDraft;
  if (!d || ![d.note_cuisine, d.note_cadre, d.note_service].every(n => n === null || isStarRating(n))
      || typeof d.text !== "string" || !Array.isArray(d.tags) || !Array.isArray(d.photoUris)) {
    throw new Error("review_draft_invalid");
  }
  return { ...d, text: d.text.slice(0, 500), tags: d.tags.filter(t => REVIEW_TAGS.includes(t)),
    photoUris: d.photoUris.filter(p => typeof p === "string").slice(0, 3) };
}

// Sérialisation : le dernier brouillon ne peut pas être remplacé par un ancien envoi.
let draftTail: Promise<unknown> = Promise.resolve();
export function saveReviewDraft(owner: string, spawtId: string, draft: ReviewDraft): Promise<void> {
  const result = draftTail.then(() => AsyncStorage.setItem(draftKey(owner, spawtId), JSON.stringify(draft)));
  draftTail = result.catch(() => undefined);
  return result;
}

export async function clearReviewDraft(owner: string, spawtId: string): Promise<void> {
  await draftTail;
  await AsyncStorage.removeItem(draftKey(owner, spawtId));
}

/** Copie hors cache pour que les photos survivent à une fermeture de l'app. */
export async function persistDraftPhoto(uri: string, owner: string, spawtId: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  const { Directory, File, Paths } = await import("expo-file-system");
  const dir = new Directory(Paths.document, "review-drafts", owner, spawtId);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `${Crypto.randomUUID()}.jpg`);
  new File(uri).copy(file);
  return file.uri;
}

export async function removeDraftPhotos(uris: readonly string[]): Promise<void> {
  if (Platform.OS === "web") return;
  const { File } = await import("expo-file-system");
  for (const uri of uris) {
    if (!uri.includes("/review-drafts/")) continue;
    try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Nettoyage best effort. */ }
  }
}
