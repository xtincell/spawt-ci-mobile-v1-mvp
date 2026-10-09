import { globalReviewRating, legacyReviewRating, readReviewRatings } from "../review-ratings";
test("5/4/4 donne 4,3 et garde 4 pour les anciennes APK", () => {
  const r = readReviewRatings({ note_cuisine: 5, note_cadre: 4, note_service: 4 })!;
  expect(globalReviewRating(r)).toBe(4.3); expect(legacyReviewRating(r)).toBe(4);
});
test("les anciens avis ne reçoivent pas de faux critères", () => {
  const oldReview = { note_etoiles: 5, note_cuisine: null };
  expect(readReviewRatings(oldReview)).toBeNull();
  expect(readReviewRatings({ note_cuisine: 5, note_cadre: 4 })).toBeNull();
  expect(readReviewRatings({ note_cuisine: 5, note_cadre: 4, note_service: 0 })).toBeNull();
  expect(readReviewRatings({ note_cuisine: 5, note_cadre: 4, note_service: 2.5 })).toBeNull();
});
