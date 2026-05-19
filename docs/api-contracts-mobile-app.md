# API Contracts — `mobile-app`

> L'app mobile parle à **Supabase** (REST/PostgREST + Realtime + Auth) via le SDK `@supabase/supabase-js`. Mode démo : aucune API n'est appelée — tout est servi par les seeds locaux.
>
> Le client est branché de façon **dynamic-import** : `data-source.supabase.ts` n'est chargé que si `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` sont définis. Ça permet de livrer une démo sans dépendance réseau.

---

## 1. Configuration client

[`app/src/lib/supabase.ts`](../app/src/lib/supabase.ts)

```ts
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "";
const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // expo-router gère son propre routing
  },
});
```

**Variables d'env attendues** (à fournir via `app/.env` ou `app.json` → `extra`) :

| Variable | Origine | Obligatoire |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | dashboard Supabase | mode live |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | dashboard Supabase | mode live |

**Détection du mode** :

```ts
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const dataSourceMode: "supabase" | "fallback" = isSupabaseConfigured ? "supabase" : "fallback";
```

Le composant [`DataSourceBanner`](../app/src/components/DataSourceBanner.tsx) affiche un bandeau jaune en mode démo.

---

## 2. Endpoints utilisés (PostgREST)

> Pas d'endpoints REST custom. L'app consomme directement les tables Supabase via le SDK. Les "contracts" sont donc les **shapes des SELECT** et **upsert**.

### 2.1 Lecture lieux

[`app/src/lib/data-source.supabase.ts:11-28`](../app/src/lib/data-source.supabase.ts#L11-L28)

```http
GET /rest/v1/places?select=*,place_adn(*)&is_published=eq.true
```

**Réponse attendue** : `Array<Place & { place_adn: PlaceAdn; total_spawts?: number }>`.

Mappée vers `PlaceWithAdn` côté client :

```ts
type PlaceWithAdn = Place & {
  adn: PlaceAdn;
  rating_display: number;   // = adn.weighted_rating
  total_spawts: number;
};
```

### 2.2 Lecture lieu unique

[`app/src/lib/data-source.supabase.ts:30-44`](../app/src/lib/data-source.supabase.ts#L30-L44)

```http
GET /rest/v1/places?id=eq.<id>&select=*,place_adn(*)
```

Retour `single()`. Renvoie `null` si l'erreur Supabase est non-null ou data manquante.

### 2.3 Lecture spawts d'un spawter

[`app/src/lib/data-source.supabase.ts:46-55`](../app/src/lib/data-source.supabase.ts#L46-L55)

```http
GET /rest/v1/spawt_checkin?spawter_id=eq.<id>&order=created_at.desc
```

**RLS attendu** : `spawter_id = auth.uid()` (RLS à mettre en place Sprint 1 Phase 0).

### 2.4 Upsert spawter

[`app/src/lib/data-source.supabase.ts:57-59`](../app/src/lib/data-source.supabase.ts#L57-L59)

```http
POST /rest/v1/spawters?on_conflict=id
Body: <Spawter>   // shape complet (cf. data-models)
Prefer: resolution=merge-duplicates
```

### 2.5 Upsert palais

[`app/src/lib/data-source.supabase.ts:61-63`](../app/src/lib/data-source.supabase.ts#L61-L63)

```http
POST /rest/v1/user_palais?on_conflict=spawter_id
Body: <UserPalais>
```

---

## 3. Auth attendu (PRD §3.1 Feature 1)

Pas encore implémenté côté client (Sprint 1 Phase 1.1). Le flow attendu :

| Étape | Provider |
|---|---|
| OTP SMS primaire | Twilio Verify ou Termii (CIV-friendly) |
| Google Sign-In secondaire | `@react-native-google-signin/google-signin` |
| Session JWT | Supabase Auth (alimentée par le provider OTP custom) |

L'écran [`(onboarding)/phone.tsx`](../app/app/%28onboarding%29/phone.tsx) est aujourd'hui un **stub** (mode démo : pas d'OTP réel).

---

## 4. Realtime (à venir)

Phase 2 V1.5+ : abonnements Supabase Realtime sur `place_adn` (push d'updates de score) et `spawt_checkin` (notifs ami spawte). Pas de canal Realtime ouvert en Sprint 1.

---

## 5. Storage (avis avec photos — Feature 6)

À configurer Phase 1.3 :

- Bucket `place-photos` — upload via `supabase.storage.from("place-photos").upload(...)`
- Bucket `place-covers` — read-only public
- Politique RLS : seul l'auteur du `spawt_checkin` peut écrire dans les sous-dossiers `<spawter_id>/<spawt_id>/`.

Aucune ligne de code Storage encore livrée.

---

## 6. Webhooks externes attendus (PRD §11)

Hors Sprint 1, listés pour référence :

| Webhook | Provider | Cible |
|---|---|---|
| Paiement confirmé | CinetPay | Edge Function Supabase → upsert `subscriptions`, log `payment_completed` |
| OTP envoyé | Twilio/Termii | Optionnel — log `auth_otp_sent` |

---

## 7. Anti-fraude — règles serveur attendues

Les 6 règles `ANTIFRAUD_RULES` (cf. [data-models §5.1](./data-models-mobile-app.md#51-constantes-anti-fraude--invariants-techniques)) **doivent** être appliquées en triggers SQL — la duplication client est uniquement informative. Voir cahier Sprint 1 §5.3.

---

## 8. Liens

- Adaptateur client : [`app/src/lib/data-source.ts`](../app/src/lib/data-source.ts)
- Implémentation Supabase : [`app/src/lib/data-source.supabase.ts`](../app/src/lib/data-source.supabase.ts)
- Données models : [data-models-mobile-app.md](./data-models-mobile-app.md)
