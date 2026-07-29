// Comparaison de secrets à temps constant (Edge Functions, runtime Deno).
//
// Les comparaisons `===` sur des secrets (clé cron, service role, token) sortent
// dès le premier octet différent → une mesure de temps réseau peut, en théorie,
// révéler le secret octet par octet. `safeEqual` compare TOUJOURS toute la
// longueur : différence de longueur → false immédiat (la longueur d'un secret
// n'est pas confidentielle), sinon OU-exclusif accumulé sur tous les octets.
//
// (Deno n'expose pas `crypto.timingSafeEqual` de Node ; on encode en octets et
// on accumule — suffisant pour des comparaisons de jetons d'en-tête.)
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
