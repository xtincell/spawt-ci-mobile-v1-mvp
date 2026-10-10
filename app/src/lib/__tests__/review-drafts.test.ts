import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearReviewDraft, loadReviewDraft, saveReviewDraft, type ReviewDraft } from "../review-drafts";
const draft: ReviewDraft = { note_cuisine: 5, note_cadre: 4, note_service: 4, tags: ["copieux"], text: "Brouillon", photoUris: ["file:///documents/review-drafts/photo.jpg"] };
beforeEach(() => AsyncStorage.clear());
test("reprend notes, texte et photos après remount et reste isolé par compte", async () => {
  await saveReviewDraft("alex", "visit", draft);
  expect(await loadReviewDraft("alex", "visit")).toEqual(draft);
  expect(await loadReviewDraft("another", "visit")).toBeNull();
  await clearReviewDraft("alex", "visit");
  expect(await loadReviewDraft("alex", "visit")).toBeNull();
});
test("le dernier état gagne malgré des sauvegardes successives", async () => {
  await Promise.all([saveReviewDraft("alex", "visit", draft), saveReviewDraft("alex", "visit", { ...draft, text: "Dernier état" })]);
  expect((await loadReviewDraft("alex", "visit"))?.text).toBe("Dernier état");
});
