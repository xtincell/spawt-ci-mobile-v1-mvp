# Story 4.8: Refactor date_of_birth dynamique

Status: ready-for-dev

<!-- Epic 4 PASS 2 — bundle UX retour user 2026-05-20 point #2 (CGU).
Remplace `age_range: '18-24'|...` figé par `date_of_birth: ISODateString`.
KPI funnel conservé via helper `ageRangeFromDateOfBirth()` pur. -->

## Story

As a spawter,
I want pouvoir saisir ma date de naissance précise plutôt qu'une tranche d'âge figée,
so that le Chat puisse me souhaiter mon anniversaire et que les KPIs démographiques restent calculables côté funnel.

## ⚠️ Brownfield context — read first

État courant Story 4.8 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Type `AgeRange` | [app/src/types/spawter.ts:28](../../app/src/types/spawter.ts#L28) | ✅ Existe : `'18-24'|'25-34'|'35-44'|'45-54'|'55+'` | **Conserver** comme alias pour KPI funnel. Ajouter `ISODateString` + `date_of_birth: ISODateString \| null` |
| Champ `age_range` Spawter row | DB `spawters.age_range` (Story 2.4) | ✅ Existe — colonne nullable | **Garder colonne** (compat) + ajouter `date_of_birth date` colonne |
| OnboardingDraft | [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) | ✅ A `age_range: AgeRange \| null` | **Remplacer** par `date_of_birth: ISODateString \| null` ; conserver l'export `age_range` calculé via helper |
| Écran `(onboarding)/profile.tsx` choix tranche | [app/app/(onboarding)/profile.tsx:227-242](../../app/app/(onboarding)/profile.tsx#L227-L242) | ✅ Choix `AGE_RANGES` à pastilles | **Remplacer** par `<DateInput />` (year picker iOS + spinner Android) |
| Lib datetimepicker | (aucun) | ❌ | **Installer** `@react-native-community/datetimepicker` (force rebuild EAS — pas OTA-able) |
| `finalizeOnboarding` insert spawter | [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) | ✅ Persiste `age_range` | **Adapter** — persiste `date_of_birth` + `age_range` (calculé via helper) |
| i18n strings | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) (`onboarding.age_*`) | ✅ Déjà refondus (bundle UX commit `feat(ux)`) | **Consommer** tels quels |
| Event analytics | [documentation/analytics/events.md](../../documentation/analytics/events.md) | ⚠️ Event `onboarding_step_completed` payload contient `age_range` | **Conserver** — émis avec age_range dérivé. Pas de PII brute (date) dans analytics. |

**Décisions héritées non-revisitables** :

- **Pas de PII brute en analytics** — Madame Sun consume `age_range` only (anonymisé). `date_of_birth` reste DB-only.
- **Wording joyeux anniv** déjà figé dans `fr.json` (`onboarding.age_body`) — bundle UX commit séparé. Ne pas le rééditer.
- **`age_range` ne peut PAS être null V1** sur le row spawters — calculé depuis `date_of_birth` au moment du finalize.
- **Min âge légal = 13 ans** (RGPD-équivalent CIV). Si `date_of_birth` calcule âge < 13, refuser onboarding.

## Acceptance Criteria

**AC #1 — Migration Supabase 0020**

**Given** la table `spawters` existante (Story 2.4)
**When** la migration `0020_add_date_of_birth_to_spawters.sql` est appliquée
**Then** :

```sql
ALTER TABLE spawters
  ADD COLUMN date_of_birth date,
  ADD CONSTRAINT spawters_dob_min_age CHECK (date_of_birth IS NULL OR date_of_birth <= now() - interval '13 years');

CREATE INDEX IF NOT EXISTS idx_spawters_dob ON spawters(date_of_birth);
```

Migration `.down.sql` apparié :

```sql
DROP INDEX IF EXISTS idx_spawters_dob;
ALTER TABLE spawters DROP CONSTRAINT IF EXISTS spawters_dob_min_age;
ALTER TABLE spawters DROP COLUMN IF EXISTS date_of_birth;
```

**AC #2 — Helper `ageRangeFromDateOfBirth()`**

**Given** `app/src/lib/age-range.ts` à créer
**Then** la fonction pure existe :

```ts
import type { AgeRange } from "../types/spawter";

export type ISODateString = string; // 'YYYY-MM-DD'

export function ageRangeFromDateOfBirth(dob: ISODateString, today: Date = new Date()): AgeRange | null {
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  if (age < 13) return null;
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  return "55+";
}

export function isBirthdayToday(dob: ISODateString, today: Date = new Date()): boolean {
  const [, m, d] = dob.split("-").map(Number);
  return (today.getMonth() + 1) === m && today.getDate() === d;
}
```

Tests : `app/src/lib/__tests__/age-range.test.ts` couvrant :
- Bornes 13/14/24/25/34/35/44/45/54/55.
- Anniversaire pas encore passé dans l'année → âge - 1.
- Format invalide → `null`.
- `isBirthdayToday` true/false.

**AC #3 — Types `Spawter` + `OnboardingDraft` étendus**

`app/src/types/spawter.ts` :

```ts
export type ISODateString = string;

export interface Spawter {
  // ... existant
  date_of_birth: ISODateString | null;   // V1 nullable pour back-compat
  age_range: AgeRange | null;             // dérivé via helper au finalize
}
```

`app/src/store/onboarding-draft.ts` :

```ts
interface OnboardingDraft {
  // ... existant
  date_of_birth: ISODateString | null;
}
```

L'ancien champ `age_range` du draft est supprimé (n'est plus saisi user-side — calculé au finalize).

**AC #4 — Écran `(onboarding)/profile.tsx` — date picker**

**Given** le bloc actuel `AGE_RANGES.map((r) => <Choice ... />)`
**When** Story 4.8 est livrée
**Then** :

- Remplacer le bloc par un `<Pressable>` qui ouvre un `DateTimePicker` (mode `date`, max `new Date()`, min `1924-01-01`).
- Affichage : libellé `Field` reste `t("onboarding.age_title")` (« Ta date de naissance »).
- Hint : `t("onboarding.age_body")` (« On te souhaitera ton anniversaire, promis. (Et on garde ça discret.) »).
- Format affiché : `DD MMMM YYYY` (locale fr).
- Validation `valid` du formulaire : `draft.date_of_birth !== null && ageRangeFromDateOfBirth(draft.date_of_birth) !== null`.
- Si âge < 13 → message inline `t("onboarding.age_too_young")` (à ajouter aux strings — voir Dev Notes §3).
- Plus de `AGE_RANGES` array — purger l'import.

**AC #5 — `finalizeOnboarding` calcule age_range**

`app/src/store/spawter-store.ts` action `finalizeOnboarding` :

```ts
const spawter: Spawter = {
  // ... existant
  date_of_birth: draft.date_of_birth,
  age_range: draft.date_of_birth ? ageRangeFromDateOfBirth(draft.date_of_birth) : null,
};
```

Le row Supabase upsert envoie les 2 champs.

**AC #6 — Event analytics inchangé**

`onboarding_step_completed` (step: 'profile') continue d'émettre `age_range` dans `properties` (jamais `date_of_birth`).

**AC #7 — Tests passants**

- `age-range.test.ts` 100% des branches couvertes.
- `__tests__/store/finalize-onboarding.test.ts` mis à jour : input draft avec `date_of_birth: '1995-06-15'` → output spawter `age_range: '25-34'`.
- `__tests__/components/ProfileScreen.test.tsx` mis à jour : remplacer les selects `profile-age-18-24` par interaction picker (mock `@react-native-community/datetimepicker` via jest setup).

**AC #8 — Triple gate verte**

`cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` passe sans erreur.

## Dev Notes

### §1 — `@react-native-community/datetimepicker` install

```bash
cd app && npx expo install @react-native-community/datetimepicker
```

Force rebuild EAS (native code) — le rebuild final post-Story 4.10 couvre ce besoin. Pas de patch OTA possible pour cette dépendance.

### §2 — Min âge & date max

- `maximumDate = new Date()` (impossible de saisir une date future).
- `minimumDate = new Date(1924, 0, 1)` (cap à 100 ans).
- Refus côté validation `valid` si `ageRangeFromDateOfBirth(dob) === null` (< 13).

### §3 — String i18n à ajouter

Si pas déjà présente, ajouter dans `app/src/i18n/fr.json` sous `onboarding` :

```json
"age_too_young": "Spawt arrive bientôt pour toi — on se retrouve à tes 13 ans.",
"age_select_cta": "Choisir ma date"
```

Si déjà présentes (vérif via `grep "age_too_young" app/src/i18n/fr.json`), no-op.

### §4 — Compatibilité données existantes

Les rows spawters créés Sprint 1 alpha (pre-4.8) ont `date_of_birth = null` et `age_range != null`. **Ne pas casser** la lecture — `Spawter.date_of_birth` est `null`-able.

### §5 — Test Tantie Rose

- *Tantie Rose comprend-elle ?* « Ta date de naissance » + body fun → ✅
- *Brice Konan le partagerait-il sans honte ?* Date picker natif système → ✅ (pas perçu intrusif)
- *Dominic sent-il qu'il appartient ?* Tonalité légère « promis » + « on garde ça discret » → ✅

## Files touched (estimation)

| Fichier | Type | Lignes estimées |
|---|---|---|
| `supabase/migrations/0020_add_date_of_birth_to_spawters.sql` | new | +10 |
| `supabase/migrations/0020_add_date_of_birth_to_spawters.down.sql` | new | +4 |
| `app/src/lib/age-range.ts` | new | +40 |
| `app/src/lib/__tests__/age-range.test.ts` | new | +60 |
| `app/src/types/spawter.ts` | modif | ±5 |
| `app/src/store/onboarding-draft.ts` | modif | ±10 |
| `app/src/store/spawter-store.ts` | modif | ±15 |
| `app/app/(onboarding)/profile.tsx` | modif | ±40 |
| `app/__tests__/store/finalize-onboarding.test.ts` | modif | ±10 |
| `app/__tests__/components/ProfileScreen.test.tsx` | modif | ±20 |
| `app/package.json` | modif | +1 dep |
| `app/src/i18n/fr.json` | modif (si nécessaire) | +2 keys |

## Done definition

- Triple gate verte.
- Migration 0020 appliquée + .down.sql testé via rollback local.
- Manuel : créer un row spawter onboarding via APK preview, date `2025-05-21` → erreur affichée. Date `1995-06-15` → row inséré avec `age_range='25-34'`.
- Snapshot test `age_range_distribution` Supabase confirme que les rows pré-existants sont intacts.
