import * as ImagePicker from "expo-image-picker";
import { pickGalleryImage } from "../../src/lib/pick-gallery-image";

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(() => { throw new Error("No library permission expected"); }),
}));
const openPicker = jest.mocked(ImagePicker.launchImageLibraryAsync);
beforeEach(() => jest.clearAllMocks());

test("selects one image through the system without requesting library access", async () => {
  const uri = "file:///cache/selected.jpg";
  openPicker.mockResolvedValueOnce({ canceled: false, assets: [{ uri, width: 24, height: 24 }] });
  await expect(pickGalleryImage({ allowsEditing: true, aspect: [1, 1] })).resolves.toBe(uri);
  expect(openPicker).toHaveBeenCalledWith({ mediaTypes: ["images"], allowsMultipleSelection: false, legacy: false, allowsEditing: true, aspect: [1, 1], quality: 1 });
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

test("cancel does not return a file or request library access", async () => {
  openPicker.mockResolvedValueOnce({ canceled: true, assets: null });
  await expect(pickGalleryImage()).resolves.toBeNull();
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});
