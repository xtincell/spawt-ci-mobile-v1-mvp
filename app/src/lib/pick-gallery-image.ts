import type { ImagePickerOptions } from "expo-image-picker";

type GalleryOptions = Pick<ImagePickerOptions, "allowsEditing" | "aspect" | "quality">;

// The system grants access only to the file the user picks.
export async function pickGalleryImage(options: GalleryOptions = {}): Promise<string | null> {
  const picker = await import("expo-image-picker");
  const result = await picker.launchImageLibraryAsync({
    quality: 1,
    ...options,
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    legacy: false,
  });
  return result.canceled ? null : result.assets?.[0]?.uri ?? null;
}
