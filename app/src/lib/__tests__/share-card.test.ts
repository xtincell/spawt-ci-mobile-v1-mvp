// Capture & partage (lib/share-card.ts) — react-native-view-shot et
// expo-sharing mockés : succès, indisponibilité, échec de capture, ref null.

const mockCaptureRef = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import type { Component } from "react";
import { captureAndShareView } from "../share-card";

const FAKE_REF = {} as Component;

beforeEach(() => {
  mockCaptureRef.mockReset().mockResolvedValue("file:///tmp/carte.png");
  mockIsAvailableAsync.mockReset().mockResolvedValue(true);
  mockShareAsync.mockReset().mockResolvedValue(undefined);
});

describe("captureAndShareView", () => {
  it("capture en PNG puis ouvre la share sheet → true", async () => {
    const shared = await captureAndShareView(FAKE_REF, "Partage ta carte");
    expect(shared).toBe(true);
    expect(mockCaptureRef).toHaveBeenCalledWith(FAKE_REF, {
      format: "png",
      quality: 1,
    });
    expect(mockShareAsync).toHaveBeenCalledWith("file:///tmp/carte.png", {
      mimeType: "image/png",
      dialogTitle: "Partage ta carte",
    });
  });

  it("ref null → false, rien n'est appelé", async () => {
    expect(await captureAndShareView(null)).toBe(false);
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("partage indisponible (web/émulateur) → false sans capture", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    expect(await captureAndShareView(FAKE_REF)).toBe(false);
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("capture en échec → false, jamais de throw", async () => {
    mockCaptureRef.mockRejectedValue(new Error("boom natif"));
    expect(await captureAndShareView(FAKE_REF)).toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("share sheet en échec → false, jamais de throw", async () => {
    mockShareAsync.mockRejectedValue(new Error("dismissed"));
    expect(await captureAndShareView(FAKE_REF)).toBe(false);
  });
});
