/** Liens de l'app installée ; aucune page web de lieu n'est encore hébergée. */
export function buildPlaceShareUrl(placeId: string): string {
  return `spawt://place/${encodeURIComponent(placeId)}`;
}

export function normalizeCrewInviteCode(value: string | string[] | undefined): string | null {
  const code = (Array.isArray(value) ? value[0] : value)?.trim().toUpperCase();
  return code && /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

/** Ouvre le formulaire de la Meute ; rejoindre demande un geste explicite. */
export function buildCrewInviteUrl(code: string): string {
  return `spawt://meute?crewCode=${encodeURIComponent(code.trim().toUpperCase())}`;
}
