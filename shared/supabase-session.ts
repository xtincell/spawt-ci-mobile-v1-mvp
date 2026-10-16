/** Raccord au renouvellement du SDK, commun au mobile et à la console.
 * Aucun jeton ni stockage supplémentaire : la session SDK reste l'autorité. */
interface Session {
  access_token: string;
  user: { id: string };
}

export interface SessionAuth {
  getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
  refreshSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
}

function rejectedIdentity(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "status" in error && error.status === 403
    && "code" in error && error.code === "bad_jwt";
}

export function createSupabaseSessionRecovery(
  backendUrl: string,
  getAuth: () => SessionAuth | undefined,
  transport: typeof fetch = (...args) => fetch(...args),
) {
  const restUrl = new URL(`${backendUrl.replace(/\/$/, "")}/rest/v1/`);
  let pending: { token: string; owner: string; promise: Promise<Session | null> } | undefined;

  async function session(): Promise<Session | null> {
    try {
      const result = await getAuth()?.getSession();
      return result && !result.error ? result.data.session : null;
    } catch {
      return null;
    }
  }

  async function refresh(expected: Session): Promise<Session | null> {
    if (pending) {
      return pending.token === expected.access_token && pending.owner === expected.user.id
        ? pending.promise : null;
    }
    const promise = (async () => {
      try {
        const current = await session();
        if (!current || current.user.id !== expected.user.id) return null;
        if (current.access_token !== expected.access_token) return current;
        const result = await getAuth()?.refreshSession();
        if (!result || result.error || result.data.session?.user.id !== expected.user.id) return null;
        const latest = await session();
        return latest?.user.id === expected.user.id && latest.access_token !== expected.access_token
          ? latest : null;
      } catch {
        return null;
      }
    })();
    const attempt = { token: expected.access_token, owner: expected.user.id, promise };
    pending = attempt;
    try { return await promise; }
    finally { if (pending === attempt) pending = undefined; }
  }

  const recoveredFetch: typeof fetch = async (input, init) => {
    // Pas de rejeu des flux/fichiers, ni des endpoints Auth, Storage ou Edge.
    // getUser() tient le verrou Auth : renouveler depuis son transport bloquerait
    // le SDK. La reprise de cette lecture se fait après sa réponse, ci-dessous.
    const address = typeof input === "string" ? input : input instanceof URL ? input.href : null;
    let eligible = false;
    if (address && (init?.body == null || typeof init.body === "string")) {
      try {
        const url = new URL(address);
        eligible = url.origin === restUrl.origin && url.pathname.startsWith(restUrl.pathname)
          && ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes((init?.method ?? "GET").toUpperCase());
      } catch { /* Le transport existant remonte une adresse invalide. */ }
    }
    const headers = new Headers(init?.headers);
    const before = eligible ? await session() : null;
    const owned = before && headers.get("Authorization") === `Bearer ${before.access_token}`;
    const response = await transport(input, init);
    if (!owned || !before || response.status !== 401 || init?.signal?.aborted) return response;
    // PGRST301 = échec de vérification JWT, avant l'exécution de la requête.
    // Une erreur SQL/RLS, réseau ou une clé Kong inconnue ne déclenche rien.
    // https://docs.postgrest.org/en/v12/references/errors.html#group-3-jwt
    try {
      const error: unknown = await response.clone().json();
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "PGRST301") return response;
    } catch { return response; }
    const renewed = await refresh(before);
    if (!renewed || init?.signal?.aborted) return response;
    headers.set("Authorization", `Bearer ${renewed.access_token}`);
    // Un seul rejeu, avec le même corps, les mêmes filtres et le même compte.
    return transport(input, { ...init, headers });
  };

  async function getUser<T extends { data: { user: { id: string } | null }; error: unknown }>(
    verify: () => Promise<T>,
  ): Promise<T> {
    const before = await session();
    const result = await verify();
    if (!before || !rejectedIdentity(result.error) || !await refresh(before)) return result;
    const retried = await verify();
    return retried.data.user && retried.data.user.id !== before.user.id ? result : retried;
  }

  return { fetch: recoveredFetch, getUser };
}
