import { Platform } from "react-native";
const mockBytes = new Uint8Array([255, 216, 1, 2]).buffer;
const mockArrayBuffer = jest.fn(() => Promise.resolve(mockBytes));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ arrayBuffer: mockArrayBuffer })) }));
const mockUpload = jest.fn().mockResolvedValue({ error: null });
const mockSign = jest.fn().mockResolvedValue({ data: [{ path: "author/visit/0.jpg", signedUrl: "https://storage.example/signed" }], error: null });
jest.mock("../supabase", () => ({ supabase: { storage: { from: () => ({ upload: mockUpload, createSignedUrls: mockSign }) } } }));
import { uploadReviewPhoto, resolveReviewPhotoUrls } from "../storage-photos";
test("Android envoie les octets du fichier, jamais un Blob", async () => {
 const old = Platform.OS; Platform.OS = "android";
 try {
  expect(await uploadReviewPhoto("file:///photo.jpg", "author", "visit", 0)).toBe("author/visit/0.jpg");
  expect(mockUpload).toHaveBeenCalledWith("author/visit/0.jpg", mockBytes, expect.objectContaining({ contentType: "image/jpeg" }));
 } finally { Platform.OS = old; }
});
test("les chemins privés deviennent des URL signées et les chemins invalides sont écartés", async () => {
 const urls = await resolveReviewPhotoUrls(["author/visit/0.jpg", "../../private.jpg", "https://legacy.example/photo.jpg"]);
 expect(urls.get("author/visit/0.jpg")).toBe("https://storage.example/signed");
 expect(urls.has("../../private.jpg")).toBe(false);
 expect(urls.get("https://legacy.example/photo.jpg")).toBe("https://legacy.example/photo.jpg");
 expect(mockSign).toHaveBeenCalledWith(["author/visit/0.jpg"], 3600);
});
