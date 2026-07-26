# AUDIT — Note MAJ consolidée MVP V1 (#V07 + R1→R28 + Q1→Q4)

**Date d'audit : 2026-07-26** · Branche `claude/app-finale-ios-android-f8ewrp` · Audit contre le **code actuel** (pas contre les notes de livraison).

Périmètre audité :

- **Note consolidée du 06/07/2026** (retours build 04/06) : #V07 + R1→R13 + Q1→Q3 + textes définitifs §5.
- **Extension livrée le 07/07** (même note, chantiers R14→R21 + Q4) — cf. `documentation/livraison-maj-consolidee-2026-07-07.md`.
- **Retours build 8 (10/07/2026)** : R22→R28 (tracés dans les commits `aeb9de8`→`5b3db41` et les commentaires de code `R22 (build 8)`…).
- Il n'existe **aucune référence R29+** dans la note, le code ou le journal — R28 clôt la série.

Verdict global : **28/28 R conformes** (dont 1 remis en conformité par cet audit : R13), **4/4 Q conformes** (Q4 = appliquée en mode réversible, décision data toujours ouverte), **#V07 conforme**.

---

## P0 — Authentification

| Réf | Exigence | État | Preuve (fichier:ligne) |
|---|---|---|---|
| **#V07** | OTP fonctionnel bout-en-bout : envoi, validation, expiration, renvoi, erreurs | ✅ conforme | `app/app/(onboarding)/otp.tsx:26-28` (`CELL_COUNT = 6`, `DEMO_CODE = "123456"`) ; `supabase/functions/otp-verify/index.ts:53` (`MOCK_OTP_CODE = "123456"`) ; `supabase/functions/otp-send/index.ts:17` (mock par défaut) ; renvoi + cooldown + erreurs gérés dans `otp.tsx` |

> ⚠️ **Code mock = `123456` (6 chiffres) — c'est la version FINALE.** La note de livraison du 07/07 et `RELEASES.md` (build 6) parlent de `12345678` : c'était vrai au build 6, puis le code a été **unifié à 6 chiffres, aligné sur le pin Termii réel** (amendement PRD version finale, repris dans `CLAUDE.md` et `.claude/skills/spawt-dev/SKILL.md:51`). Ne pas « re-corriger » vers 8 chiffres. Un erratum a été ajouté en tête de `livraison-maj-consolidee-2026-07-07.md`.

## Onboarding — « Présente-toi » (R1-R4)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R1** (P0) | Commune en liste déroulante (Cocody, Yopougon, Marcory…) | ✅ conforme | `app/app/(onboarding)/profile.tsx:59-74` (13 communes + « Autre »), `:303-310` (Select) ; clés `onboarding.commune.*` dans `app/src/i18n/fr.json` |
| **R2** | Aide commune = « Pour t'afficher des lieux proches de toi. » | ✅ conforme | `app/src/i18n/fr.json:366` (texte exact) ; affiché en hint `profile.tsx:297-300` |
| **R3** | Pays résidence + origine en liste déroulante | ✅ conforme | `profile.tsx:318-328` (résidence Select), `:336-353` (origine Select). Décision produit 07/2026 : « Pays d'origine » **conservé**, togglable via flag `onboarding-origin-country` (`supabase/seed/feature_flags_produit.sql:23-26`, ON partout) |
| **R4** | Date de naissance : gabarit jj/mm/aaaa + aide « Joyeux anniversaire… » | ✅ conforme | `profile.tsx:437-441` (gabarit/format jj/mm/aaaa), `:456-474` (DateTimePicker natif, masque web `:158-182`) ; aide exacte `fr.json:397` |

## Onboarding — questions du Palais (R5-R7, R16, R25)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R5** (P0) | 4 cadres sans quartier : Garbadrome / Foodtruck / Restaurant chic / Brunch | ✅ conforme | `fr.json:505-508` — libellés exacts, préfixés d'un emoji depuis R25 (`🍢 Garbadrome`…) |
| **R6** | « Je sors pour… » : Manger · Découvrir · En groupe · En duo + icônes | ✅ conforme | `fr.json:228` (titre), `:231-247` (labels) ; icônes fork/compass/users/heart `app/src/components/ModeStories.tsx:26-29` |
| **R7** | Bloc mascotte AVANT la sélection des 3 suggestions, copy « Voici mes 3 suggestions du jour. » | ✅ conforme | `app/app/(tabs)/index.tsx:387-400` (ChatBubble au-dessus du carrousel) ; texte exact `fr.json:229` |
| **R16** | Cuisine en liste déroulante | ✅ conforme | `app/app/(onboarding)/calibration.tsx:7-8,117-121` (Select multi sur l'axe cuisine) |
| **R25** | Un emoji par option du questionnaire | ✅ conforme | commit `ed860d9` ; visible sur toutes les cartes de calibration dans `fr.json` (blocs `card`) |

## Écran « Voici ton Palais » (R8-R9)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R8** (P0) | Radar retiré du parcours utilisateur (exploitation interne only) | ✅ conforme | `app/app/(onboarding)/palais-reveal.tsx:7-11` (reveal par carte d'archétype) ; carte spawter en **barres** pour tous les tiers `app/src/components/SpawterCard.tsx:293-297,370` ; `AxisRadar`/`PalaisRadar` ne sont plus montés dans aucun écran (`grep` : seul l'export `primitives/index.ts:12` subsiste) |
| **R9** | Bloc du haut supprimé, « juste le titre » | ✅ conforme | `palais-reveal.tsx:186` + `fr.json:780` (« Voici ton palais ») |

## Fiche lieu (R10-R12, R17-R19, R21-R22, Q1-Q2, Q4)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R10** (P0) | Bouton « Appeler » doublon supprimé, localisation sur carte | ✅ conforme | `app/app/place/[id]/index.tsx:675-677` (rang CTAs supprimé), `:847-877` (carte statique + adresse) |
| **R11** | CTA « Spawt le ! » | ✅ conforme | `fr.json:791` (texte exact) ; CTA sticky `place/[id]/index.tsx:936-974` |
| **R12** | Horaires + jours d'ouverture | ✅ conforme | `app/src/components/OpeningHours.tsx:1` (7 jours Lun→Dim, jour courant en évidence) ; monté `place/[id]/index.tsx:896` |
| **R17** | Fiche en onglets Média · Menu · Avis | ✅ conforme | `place/[id]/index.tsx:94,760-763` ; `app/src/components/place/PlaceTabs.tsx` ; labels `fr.json:820-822` |
| **R18** | Contact relégué en section « Divers » | ✅ conforme | `place/[id]/index.tsx:900-903` ; `fr.json:832` (`divers_title`) |
| **R19** | Ordre Média > Menu > Avis > Carte | ✅ conforme | `place/[id]/index.tsx:760-763` (onglets), `:847-848` (carte/horaires après) |
| **R21** | Prix moyen en F CFA | ✅ conforme | `place/[id]/index.tsx:284-291` (`~N F CFA` depuis `avg_ticket_xof`, fallback ₣) ; `app/src/lib/format-price.ts:24` ; flag `place-avg-price` ON (`feature_flags_produit.sql:19-22`) |
| **R22** | Fiches lieu ne crashent plus (rows sans `place_adn`) | ✅ conforme | `app/src/types/place.schema.ts:31`, `app/src/lib/data-source.supabase.ts:66,92` (ADN neutre par défaut), tests `app/src/lib/__tests__/data-source-place-parse.test.ts` |
| **Q1** | 3 photos de présentation + galerie des spawters | ✅ conforme | `app/src/components/place/PlaceMediaTab.tsx:21-22` (`PRESENTATION_MAX = 3`), `:4-7` (galerie depuis `spawt_checkin.photos`) |
| **Q2** | Page « Tous les avis » | ✅ conforme | `app/app/place/[id]/reviews.tsx:1-6` ; lien « Voir tous les avis (N) » `fr.json:812` ; titre `fr.json:817` |
| **Q4** | Méthode du prix moyen | ✅ appliquée / 🟡 décision ouverte | Implémentée en réversible (source `avg_ticket_xof` éditoriale, flag `place-avg-price`) — décision méthode = Kidam, cf. `documentation/decisions-produit-ouvertes-2026-07-07.md` |

## Transverse & design system (R13-R15, R20, R23-R24)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R13** | Plus de « on » sur les écrans utilisateur (tutoiement admis) | ✅ **remis en conformité par cet audit** | La passe du 07/07 était propre, mais les features livrées ensuite (badges, archétypes, crew, wrapped, suggestions) avaient réintroduit **10 « on »** dans `fr.json`. **Corrigés dans cet audit** : `badge.eclaireur.description`, `badge.defi_releve.description`, `archetype.pilier_de_colonie.portrait`, `archetype.bouchedor.portrait`, `suggest.description_placeholder`, `crew.share_invite`, `crew.host_cta_resolve` (« On tranche » → « Tranche »), `crew.share_result`, `wrapped.intro_body`, `wrapped.slide_top_place_caption_one/other`. **1 exception assumée** : `badge.meneur_de_crew.description` — « On mange où ce soir ? » est un discours direct rapporté (la question de la bande), signature produit ; couverte par l'allowlist du conformity-check |
| **R14** | Fond beige → blanc | ✅ conforme | `app/src/theme/tokens.ts:28,48,50` (`surface.base` = `#FFFFFF`) |
| **R15** | Écran d'ouverture animé | ✅ conforme | `app/src/components/brand/AppOpening.tsx` (logo carte → Moka + tagline) ; monté `app/app/_layout.tsx:193,308` |
| **R20** | Feed : lieux ouverts d'abord | ✅ conforme | `app/app/(tabs)/index.tsx:134` ; `app/src/lib/opening-hours.ts` (`partitionOpenFirst`, tri stable, créneaux de nuit) |
| **R23** | Ouverture animée à CHAQUE lancement | ✅ conforme | `app/app/_layout.tsx:193` ; `app/app/index.tsx:4` ; tests `app/__tests__/components/AppOpening.test.tsx` |
| **R24** | Cadrage Moka dans les cercles (tête coupée) | ✅ conforme | `app/src/components/brand/CatMark.tsx:94-103` (fit CONTAIN + padding ~8 %) |

## Profil (R27-R28, Q3)

| Réf | Exigence | État | Preuve |
|---|---|---|---|
| **R26** | Aide « Pays d'origine » : texte exact | ✅ conforme | `fr.json:388` — « Pour te proposer les goûts de chez toi. (Optionnel, promis) » (commit `fd205ed`) |
| **R27** | Changement de photo de profil (galerie ou caméra) | ✅ conforme | `app/app/(tabs)/profile.tsx:119` ; `app/src/lib/storage-avatars.ts` (bucket `avatars`, migration `0031`) ; `app/src/store/spawter-store.ts:229` |
| **R28** | Compteur « Avis » supprimé → « Spawts » | ✅ conforme | `app/src/components/SpawterCard.tsx:223-229` |
| **Q3** | « Spawts » = lieux spawtés · « Favoris » = sauvegardés | ✅ conforme | `SpawterCard.tsx:226-229` ; labels `fr.json:727-728` |

---

## Écarts corrigés par cet audit (S)

1. **R13 — 10 strings** `app/src/i18n/fr.json` reformulées sans « on » (détail ci-dessus) + commentaires de code alignés (`crew-store.ts`, `crew-resolution.ts`, `crew-store.test.ts`). Triple gate verte après correctif (tsc 0 · vocab ✓ · i18n ✓ · jest 693 passed).
2. **Documentation** — erratum ajouté en tête de `livraison-maj-consolidee-2026-07-07.md` : le code mock est passé de `12345678` (build 6) à `123456` (version finale, 6 chiffres alignés Termii).

## Écarts restants (aucun bloquant)

- **Q4 (décision data, pas un écart code)** : la méthode de calcul du prix moyen reste à trancher par Kidam — l'affichage et l'interrupteur (`place-avg-price`) sont prêts.
- **R3 (décision produit actée mais réversible)** : « Pays d'origine » conservé derrière le flag `onboarding-origin-country` — Stephanie peut couper sans redéploiement.
- **`RELEASES.md`** : les entrées build 6/7 citent le code `12345678` — exact historiquement, ne pas réécrire (journal de livraison). La prochaine entrée de release devra citer `123456`.

## Outillage de non-régression

Chaque texte exact de la note (R2, R4, R5, R6, R7, R9, R11, R26), le code OTP `123456`, la purge « on » (R13) et le Contrat SPAWT (pas de `spawter_id` dans `challenge_progress`, pas de leaderboard) sont désormais **verrouillés mécaniquement** par `documentation/conformity-checklist.yaml` + `node scripts/conformity-check.mjs` (branché en CI après la triple gate).
