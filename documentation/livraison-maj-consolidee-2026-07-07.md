# SPAWT — Livraison MAJ consolidée MVP V1 (2026-07-07)

> **ERRATUM (version finale, 07/2026)** — Les mentions du code de connexion `12345678` ci-dessous étaient exactes au build 6. Le code mock a depuis été **unifié à `123456` (6 chiffres, aligné pin Termii réel)** : amendement PRD version finale, cf. `CLAUDE.md` et `documentation/AUDIT_NOTE_MAJ_R1-R28.md` (#V07). Ne pas « re-corriger » vers 8 chiffres.

**Build de validation : `v1.0.0 — build 6 (2026-07-07)`** · Tag CI `build-android-2026-07-07-6` · Branche `spawt/v1-maj-consolidee`

Message prêt pour le groupe WhatsApp « Suivi des maj du MVP » — tableau de couverture façon §8 de la note.

---

## 📱 Message WhatsApp (copier-coller)

> **SPAWT — build 6 dispo (07/07)** ✅
>
> La MAJ consolidée des retours du build 04/06 est prête à valider. Tous les P0 sont réglés, les 21 R et les questions Q couverts (détail ci-dessous).
>
> **Le login marche** : numéro CI + code **12345678**.
> APK : lien EAS dans le fil (build 6). Checklist de test dans RELEASES.md.
>
> Restent 2 décisions produit ouvertes : la **méthode de calcul du prix moyen** (Q4, pour Kidam) et le maintien du champ **« Pays d'origine »** (R3, pour Stephanie).

---

## Tableau de couverture (références de la note)

| Réf | P | Correctif demandé | État | Où le voir |
|---|---|---|---|---|
| **#V07** | P0 | OTP : le code doit authentifier | ✅ | Login : code **12345678** → session réelle (vérifié sur les 2 backends) |
| **R1** | P0 | Commune en liste déroulante | ✅ | Onboarding « Ta commune » (13 communes + Autre) |
| **R2** | P1 | Aide commune (texte exact) | ✅ | « Pour t'afficher des lieux proches de toi. » |
| **R3** | P1 | Pays en liste déroulante | ✅ | Résidence + origine en Select (⚠️ maintien « origine » à confirmer produit) |
| **R4** | P1 | Date jj/mm/aaaa + aide | ✅ | Gabarit + « Pour te souhaiter Joyeux anniversaire, promis. (Et ça restera secret) » |
| **R5** | P0 | Cadres sans quartier | ✅ | Garbadrome · Foodtruck · Restaurant chic · Brunch |
| **R6** | P1 | « Je sors pour… » libellés + icônes | ✅ | Manger · Découvrir · En groupe · En duo (icônes couverts/boussole/groupe/cœur) |
| **R7** | P1 | Mascotte avant la sélection | ✅ | Feed : le Chat dit « Voici mes 3 suggestions du jour. » au-dessus du carrousel |
| **R8** | P0 | Radar hors parcours utilisateur | ✅ | Plus aucun radar (reveal épuré, carte spawter en barres) |
| **R9** | P1 | Écran Palais épuré | ✅ | Titre « Voici ton palais » + Moka celebration |
| **R10** | P0 | Bouton Appeler doublon → carte | ✅ | Rang de boutons supprimé ; carte conservée plus bas (cf. R19) |
| **R11** | P1 | CTA « Spawt le ! » | ✅ | CTA sticky de la fiche lieu |
| **R12** | P1 | Horaires + jours | ✅ | 7 jours affichés, jour courant en évidence |
| **R13** | P1 | Plus de « on » | ✅ | Copy balayée (app + quiz), tutoiement/voix du Chat |
| **R14** | P1 | Fond beige → blanc | ✅ | App + admin + quiz (crème/or conservés en accents) |
| **R15** | P1 | Écran d'ouverture animé | ✅ | Logo carte (primaire) → splash art Moka + tagline + CTA |
| **R16** | P1 | Cuisine en liste déroulante | ✅ | Calibration Q1 en Select multi (visuels cuisine : phase suivante) |
| **R17** | P1 | Fiche lieu en onglets | ✅ | Média · Menu · Avis |
| **R18** | P1 | Contact en « Divers » | ✅ | Téléphone/WhatsApp en bas de fiche |
| **R19** | P1 | Ordre Média>Menu>Avis>Carte | ✅ | Onglets puis ADN, carte, horaires, Divers |
| **R20** | P1 | Feed : lieux ouverts d'abord | ✅ | Tri stable ouverts/fermés (créneaux de nuit gérés) |
| **R21** | P1 | Prix moyen en F CFA | ✅ | « ~N F CFA » depuis `avg_ticket_xof` (fallback ₣) — méthode = Q4 |
| **Q1** | — | 3 photos + galerie spawters | ✅ | Onglet Média : présentation (≤3) + photos des spawts |
| **Q2** | — | Page « Tous les avis » | ✅ | Onglet Avis → écran dédié |
| **Q3** | — | Spawts vs favoris | ✅ | Carte spawter : « Spawts » = lieux spawtés · « Favoris » = sauvegardés |
| **Q4** | — | Méthode prix moyen | 🟡 OUVERT | Affichage prêt, source paramétrable (`avg_ticket_xof`) — décision Kidam |

**Périmètre bonus livré** (chantiers de la note hors tableau) : quiz « La Meute » porté de Cloudflare D1 vers **Postgres dédié sur le VPS** (`/api/health` réel, parcours vérifié en ligne) · design system unifié sur les 3 surfaces (plus aucun chat vectoriel, poses Moka PNG, Klinsman/Gotham partout).

## Vérification (preuves de session)

- **Gates** : `typecheck` 0 erreur · `lint:vocab` ✓ · `i18n:check` ✓ · **jest 403 passed / 0 failed** (56 suites) · vitest admin **29/29** · Deno edge **20/20**.
- **OTP bout-en-bout (curl, 07/07)** : self-hosted Coolify ET cloud Supabase — `otp-send` 200 → `otp-verify 12345678` → `user_id + access_token + refresh_token` réels ; mauvais code → `401 invalid_otp` ; ancien `123456` → rejeté.
- **Quiz en ligne** : `GET /api/health` → `{"status":"ok","db":"ok"}` (SELECT 1 réel sur la base dédiée) ; inscription → pionnier + code parrainage ; re-soumission même téléphone → carte verrouillée (anti-triche).
- **Vérif à contexte frais** : sous-agent indépendant repassé sur chaque référence R/Q contre le code (rapport en fin de session).

## Captures

Pas d'émulateur sur ce poste : les captures se prennent depuis l'APK build 6 (la checklist « À tester en priorité » de RELEASES.md liste les 5 écrans à capturer : splash animé, OTP 8 cases, commune en liste, fiche lieu onglets+prix F CFA, feed 4 modes).

## Après validation

1. Merge `spawt/v1-maj-consolidee` → `claude/ios-android-final-version-5vad3n` (déclenche le redéploiement auto de l'admin sur Coolify).
2. Décisions à trancher : **Q4** (méthode prix moyen — Kidam) · **R3** (pays d'origine — Stephanie).
3. Phase suivante : compte Termii réel (`TERMII_API_KEY` + `MOCK_TERMII=false`, pin 6 chiffres → repasser `CELL_COUNT` à 6), cutover env app/admin vers le backend self-hosted + HTTPS `api.spawt.online`.
