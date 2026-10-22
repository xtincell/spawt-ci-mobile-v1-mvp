export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface ReviewRatings {
  note_cuisine: StarRating;
  note_cadre: StarRating;
  note_service: StarRating;
}

export function isStarRating(value: unknown): value is StarRating {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function readReviewRatings(row: {
  note_cuisine?: unknown; note_cadre?: unknown; note_service?: unknown;
}): ReviewRatings | null {
  const { note_cuisine, note_cadre, note_service } = row;
  return isStarRating(note_cuisine) && isStarRating(note_cadre) && isStarRating(note_service)
    ? { note_cuisine, note_cadre, note_service } : null;
}

export function globalReviewRating(ratings: ReviewRatings): number {
  return Math.round((ratings.note_cuisine + ratings.note_cadre + ratings.note_service) / 3 * 10) / 10;
}

/** Note entière pour les anciennes APK et les signaux historiques du Palais. */
export function legacyReviewRating(ratings: ReviewRatings): StarRating {
  return Math.round(globalReviewRating(ratings)) as StarRating;
}
