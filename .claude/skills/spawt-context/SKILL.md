---
name: spawt-context
description: 'Contexte produit et architecture SPAWT. Lire avant tout travail sur ce repo : concepts métier (Palais, ADN, Guet, stades), carte du code, état des features. Use when working on any SPAWT feature, screen, or data model.'
---

# SPAWT — Contexte produit & architecture

## Le produit en 3 phrases

SPAWT tue les 45 minutes perdues à chercher où manger à Abidjan. Un chat (félin, pas chatbot) guide chaque **spawter** vers les 5 lieux qui correspondent à son **Palais** (profil gustatif), pas vers les "10 meilleurs restos de Cocody". La data vient de la communauté (la **Meute**) via des **spawts** (visites vérifiées par géolocalisation — "Le Guet").

## Concepts métier (implémentés)

- **Palais** : profil gustatif du spawter, 5 axes bipolaires [-1,1] : Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table. Calibré à l'onboarding (5 questions, ±40 sur échelle ±100), affiné à chaque spawt avec décroissance (`app/src/lib/palais-engine.ts`). Table `user_palais`.
- **ADN du lieu** : mêmes 5 axes côté lieu (Local/International, Informel/Établi, Budget/Premium, Populaire/Privé, Décontracté/Habillé). Calculé depuis les avis, `confidence_score` [0,1], "ADN en construction" si <5 avis. Table `place_adn`.
- **Matching** : score composite `0.15·cosine(Palais,ADN) + 0.30·distance + 0.30·note_pondérée + 0.10·recency + 0.15·novelty`, affiché 50-99% (`app/src/lib/matching.ts`, 23 tests).
- **Stades** (par spots **uniques**, jamais de régression) : Touriste 0-10, Explorateur 11-20, Détective 21-30, Djidji 31-50, Guide 50+. Poids des avis : 1x → 3x selon stade (`weighted-rating.ts`). Tables `spawter_progression`, `collection_titres`.
- **Archétypes** (5 MVP) : Pisteur, Bouche d'Or, Gardien du Maquis, Vent d'Ailleurs, Omnivore — dérivés des 2 axes dominants. La **mue** (changement d'archétype) = constat neutre, pas promotion. (`mue_tracking` jamais créée — la mue est calculée, pas trackée.)
- **Le Guet** : mécanique de spawt automatique (géofence 10m, timer 15min, snooze x3, fenêtre +30min, passif = poids 0.5x). Voir skill `spawt-guet`.
- **Anti-fraude** : 6 règles SQL (fréquence 1/4h même lieu, 5/jour global, vitesse >100km/h, session <5min suspecte…) — migration `0012`, triggers testés.

## Carte du code mobile (`app/`)

- Routes : `app/app/` — `(onboarding)/` consent→phone→otp→profile→calibration→palais-reveal ; `(tabs)/` index (feed "HomeD"), carte (STUB V1.5), spawter (check-in manuel géolocalisé), meute (STUB), profile ; `place/[id]/` (+reviews), `review/[spawt_id]`, `search`, `saved`.
- Logique : `app/src/lib/` — matching, palais-engine, weighted-rating, search, static-map (image statique, PAS de carte native), storage-photos, analytics (wrapper maison), guet/* (géofencing), data-source (adaptateur démo/Supabase).
- État : stores Zustand `app/src/store/`. Pas de TanStack Query, pas de NativeWind (thème custom `app/src/theme/tokens.ts`).
- UI : `app/src/components/` (24 composants), primitives dans `primitives/`.

## Backend

- Supabase projet live `ucymjsxmnzdxvvupgaof`. Tables : spawters, spawt_staff, customers/plans/currencies (squelette commercial sans paiement), user_signals (append-only ML), feature_flags, otp_attempts, user_palais, places, place_adn, spawt_checkin, spawter_progression, collection_titres, admin_audit_log.
- **Absentes volontairement** : subscriptions, invoices, mue_tracking (Sprint 2+).
- Edge Functions : otp-send/otp-verify (Termii, MOCK_TERMII pour bypass), moderate-spawter, seed-inventory.
- Auth OTP custom via Edge Functions (PAS le provider SMS natif Supabase). Google/Apple sign-in côté client (expo-auth-session).

## Hors scope V1 (décisions actées, ne pas "corriger")

Carte interactive native (V1.5), Mode Crew/Rapide/Explore, paiement CinetPay + paywall géo (Sprint 2), Coup de Cœur mécanique complète (badge statique seulement), push serveur, badges 30+, multi-villes, ML.

## Où vérifier l'état d'avancement

`_bmad-output/implementation-artifacts/sprint-status.yaml` (header = journal détaillé). Ne PAS se fier à `docs/` (snapshot périmé du 2026-05-13).
