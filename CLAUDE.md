# SPAWT — Guide agent (lire en premier)

App de découverte culinaire communautaire pour les foodies d'Abidjan.
Mission en cours : **finaliser un MVP tech-complet buildable iOS + Android** (plan : `_bmad-output/planning-artifacts/mvp-finalisation-plan.md`, part humaine : `HUMAN_TODO.md`).

## Structure du repo (4 projets distincts)

| Dossier | Quoi | Stack |
|---|---|---|
| `app/` | **L'app mobile — le produit** | Expo SDK 55, RN 0.83, expo-router, TypeScript, Zustand |
| `spawt-admin/` | Panel admin équipe | Refine v5 + Vite + React 18, Cloudflare Pages |
| `supabase/` | Backend | 23+ migrations SQL (chacune avec `.down.sql`), 4 Edge Functions Deno |
| `src/` + racine Vite | **Prototype web GELÉ** — référence visuelle uniquement | Ne jamais développer dedans |

## Sources de vérité (ordre de préséance)

1. **Le code** (`app/`, `supabase/`, `spawt-admin/`)
2. `_bmad-output/implementation-artifacts/sprint-status.yaml` — état réel des stories (header = journal)
3. `_bmad-output/planning-artifacts/` — PRD.md (avec errata), epics.md, ux-design-specification.md
4. `documentation/` — PRD source docx, cahier des charges Sprint 1, brandbook UX
5. `docs/` — ⚠️ **SNAPSHOT FIGÉ du 2026-05-13, PÉRIMÉ** : ne jamais s'y fier pour "est-ce que X est implémenté" (il dit que les migrations/OTP n'existent pas ; ils existent). OK pour l'orientation générale.

## Commandes (depuis `app/`)

```bash
npm run typecheck && npm run lint:vocab && npm run i18n:check && npm test   # "triple gate" — DOIT être verte avant tout commit
```
Admin : `cd spawt-admin && npm test` (vitest). Tests SQL : `supabase/tests/`.

## Règles non négociables

- **Vocabulaire** (enforced par `lint:vocab`) : jamais "restaurant", "check-in", "leaderboard", "user", "gamif*", "VTC/Uber/Bolt" dans le code/UI. Dire : lieu/spot, spawt, Spawter, la Meute, Le Guet, Djidji.
- **Couleurs/typos** : source unique `app/src/theme/tokens.ts`. **Aucun hex ailleurs.** Palette canonique = brandbook (`documentation/ux/spawt-tokens.css`) : noir `#0A0A0A`, or `#C8A44E`, vert chat `#2D6B4F`, blanc cassé `#FAFAF8`. ⚠️ Les valeurs du PRD §15 (`#D4AF37`, `#50C878`, Instrument Serif/Manrope) sont **périmées** (erratum PRD v1.0.3 du 2026-05-14).
- **Polices** : Klinsman (display) + Gotham (body). Piège : les `.otf` Klinsman embarquent les noms PostScript `KlinsmanTypefaceLight/Regular/Bold` — toujours référencer ces noms-là, pas les noms de fichiers.
- **i18n** : toute string UI passe par `app/src/i18n/` (vérifié par `i18n:check`).
- **Migrations** : numérotées `NNNN_description.sql` + `.down.sql` apparié + tests dans `supabase/tests/` pour la logique (cf. `0012_antifraud_triggers`). Trous 0015-0016 = réservés, normaux.
- **Textes produit** : ton du Chat SPAWT (complice, jamais corporate), français ivoirien assumé.

## État déployé (2026-05-28, cf. header sprint-status.yaml)

- Supabase live : projet `ucymjsxmnzdxvvupgaof` — migrations 0001→0023 + `places_menu_urls` (0030) appliquées, Edge Functions ACTIVE : `otp-send` v3 + `otp-verify` v3 (⚠️ verify_jwt=true depuis le redeploy MCP du 07/07 — OK, l'app envoie Bearer anon), `moderate-spawter`, `seed-inventory`. **OTP en MOCK PAR DÉFAUT** (aucun secret requis) : code de test `123456` (6 chiffres, aligné pin Termii — unifié version finale) — session réelle vérifiée le 07/07. Bascule SMS réel : `TERMII_API_KEY` + `MOCK_TERMII=false`. Un backend self-hosted (Coolify VPS) tourne en parallèle avec les mêmes fonctions (cutover envisagé, cf. sprint-status).
- EAS : projet `15ac2301-e901-4caa-a8c8-864c6621bcd0`, owner `xtincell`, keystore Android managé EAS. 3 APK alpha livrés (cf. `RELEASES.md`).
- CI : `.github/workflows/eas-build.yml` (tag `build-android-YYYY-MM-DD-N` → triple gate → APK preview), `eas-update.yml` (OTA manuel). Secret GitHub requis : `EXPO_TOKEN`.
- Git : tout le Sprint 1 (42 stories, epics 1-7) vit sur `spawt/v1-bmad` en statut "review" ; `main` est en retard. Branche de travail MVP : `claude/ios-android-final-version-5vad3n` (part de `spawt/v1-bmad`).

## Pièges connus

- `armGuet()` (géofencing) n'était appelé nulle part → câblage = chantier MVP en cours (voir skill `spawt-guet`).
- Expo Go ne supporte pas le geofencing background — tester via dev build/APK.
- Feature flag `guet-geofence` : activé seulement `internal`/`alpha` (`supabase/seed/feature_flags_guet.sql`).
- Coordonnées GPS codées en dur (`DEMO_LAT`/`DEMO_LNG`) dans recherche/feed — chantier MVP.
- Favoris = AsyncStorage uniquement ; ADN du lieu = recalcul local-only — chantiers MVP.
- Commit `9f6b325` a retiré le plugin `expo-application` pour débloquer CI (BuildBadge partiellement dégradé).
- Le mode données est un adaptateur (`app/src/lib/data-source.ts`) : démo (fixtures) vs Supabase selon env vars `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY`.

## Skills projet (`.claude/skills/spawt-*`)

`spawt-context` (produit & architecture), `spawt-dev` (workflow dev), `spawt-release` (builds EAS/CI/versioning), `spawt-guet` (architecture du Guet). Les lire avant de toucher au domaine correspondant.
