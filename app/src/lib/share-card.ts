// Capture & partage d'une vue (carte 9:16 du Wrapped, carte d'archétype…) :
// react-native-view-shot (captureRef) → expo-sharing (share sheet natif).
//
// Les deux modules natifs sont chargés en require() lazy (pattern
// monitoring.ts) : jamais importés tant que le spawter n'a pas tapé
// « Partager » — et les suites jest qui montent les écrans n'ont pas besoin
// de les mocker. Best-effort total : tout échec → `false`, jamais de crash.

import type { Component } from "react";

type CaptureRefFn = (
  ref: number | Component,
  options?: { format?: "png" | "jpg"; quality?: number },
) => Promise<string>;

interface SharingModule {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    url: string,
    options?: { mimeType?: string; dialogTitle?: string },
  ) => Promise<unknown>;
}

/**
 * Capture la vue pointée par `ref` en PNG puis ouvre la share sheet.
 * Retourne `true` si la share sheet a été présentée (le caller track), `false`
 * sur toute impossibilité (module absent, partage indisponible — web/émulateur,
 * capture en échec).
 */
export async function captureAndShareView(
  ref: Component | null,
  dialogTitle?: string,
): Promise<boolean> {
  if (!ref) return false;
  try {
    const viewShot = require("react-native-view-shot") as {
      captureRef?: CaptureRefFn;
      default?: { captureRef?: CaptureRefFn };
    };
    const captureRef = viewShot.captureRef ?? viewShot.default?.captureRef;
    if (!captureRef) return false;

    const sharingMod = require("expo-sharing") as
      | SharingModule
      | { default?: SharingModule };
    const sharing =
      "isAvailableAsync" in sharingMod
        ? (sharingMod as SharingModule)
        : (sharingMod as { default?: SharingModule }).default;
    if (!sharing) return false;

    const available = await sharing.isAvailableAsync();
    if (!available) return false;

    const uri = await captureRef(ref, { format: "png", quality: 1 });
    await sharing.shareAsync(uri, {
      mimeType: "image/png",
      ...(dialogTitle !== undefined ? { dialogTitle } : {}),
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[share-card] captureAndShareView failed", err);
    return false;
  }
}
