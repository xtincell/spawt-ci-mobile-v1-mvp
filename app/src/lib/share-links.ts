/** Public HTTPS fallback, also handled by verified Android App Links. */
export function buildPlaceShareUrl(placeId: string): string {
  return `https://spawt.online/lieu/${encodeURIComponent(placeId)}`;
}

export function normalizeCrewInviteCode(value: string | string[] | undefined): string | null {
  const code = (Array.isArray(value) ? value[0] : value)?.trim().toUpperCase();
  return code && /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

/** Ouvre le formulaire de la Meute ; rejoindre demande un geste explicite. */
export function buildCrewInviteUrl(code: string): string {
  return `spawt://meute?crewCode=${encodeURIComponent(code.trim().toUpperCase())}`;
}
