---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
documentsIncluded:
  - 'PRD.md'
  - 'architecture.md'
  - 'epics.md'
  - 'ux-design-specification.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-14
**Project:** Spawt mobile CI

## Document Inventory

| Type | File Used | Size | Modified | Format |
|---|---|---|---|---|
| PRD | `PRD.md` | 90 KB | 2026-05-13 | Whole |
| Architecture | `architecture.md` | 58 KB | 2026-05-14 | Whole |
| Epics & Stories | `epics.md` | 73 KB | 2026-05-14 | Whole |
| UX Design | `ux-design-specification.md` | 96 KB | 2026-05-14 | Whole |

**Excluded / supporting context (not under assessment):**
- `PRD-source-extracted.md` — raw extraction from `SPAWT_PRD_V1.docx`
- `PRD-validation-report.md` — prior validation output report
- `ux-design-directions.html` — design directions exploration (not the spec)
- `docs/*` — brownfield project documentation (reference context)
- `documentation/*` — source PRD `.docx`, personas, UX kit (reference context)

**Discovery result:** No whole-vs-sharded duplicate conflicts. All four core document types present. User (Alexandre) confirmed PRD = `PRD.md` and UX = `ux-design-specification.md`.

---

## PRD Analysis

**Source:** `PRD.md` — BMAD restructure v1.0.2 (2026-05-13) of SPAWT PRD V1.0.0 (John BMad, 2026-04-09). Validation status: `PASS_WITH_WARNINGS_REMEDIATED`.

### Functional Requirements

41 FRs extracted (FR-001 → FR-041). Phase indicates Sprint 1 (S1) or Sprint 2 (S2) per the PRD `Phase:` field.

| FR | Phase | Capability |
|---|---|---|
| FR-001 | S1 | Authentification spawter — création/reconnexion via téléphone + OTP (primaire) ou Google Sign-In (secondaire). Aucun email+password. |
| FR-002 | S1 | Onboarding & calibrage initial du Palais — 5 questions bipolaires (<3 min) générant Palais initial (-40..+40/axe) + saisie quartier, cuisine, budget, contexte, country_code, origin_country_code, gender, age_range. |
| FR-003 | S1 | Voix du chat évolutive — messages in-app dont le ton dépend du stade (Touriste→Guide), wording centralisé i18n. |
| FR-004 | S1 | Feed personnalisé — liste ordonnée par score composite (0,15 cosinus + 0,30 distance + 0,30 note pondérée + 0,10 recency + 0,15 novelty), affiché en % borné [50,99]. ≥10 lieux, P95 <3s 3G. |
| FR-005 | S1 | Fiche lieu détaillée — photo, nom, quartier, cuisine, prix, note pondérée, horaires, adresse, Appeler/WhatsApp, score %, badges spéciaux, radar ADN si ≥5 avis. |
| FR-006 | S1 | Le Spawt (Le Guet) — détection passive périmètre 10 m, timer 15 min, notif locale, snooze ×3, fenêtre +30 min, spawt passif 0,5x. Anti-fraude DR-FRAUD-01..06. |
| FR-007 | S1 | Avis structuré — note 1-5 obligatoire, tags rapides, texte ≤500 car., 1-3 photos (80%, ≤1 MB). Poids par stade 1x→3x ; met à jour ADN + Palais. |
| FR-008 | S1 | Profil spawter — identité, stade, titres (actuel/affiché/collection), compteurs, Palais radar 2 axes gratuit / 5 axes Gold. |
| FR-009 | S1 | Sauvegarde de lieux (Tanière) — ajout/retrait favori depuis fiche, liste au profil, signal de matching. |
| FR-010 | S1 | Progression par stades — 5 stades par spots uniques vérifiés (Touriste 0-10 → Guide 50+), écran de célébration, titre permanent, voix ajustée. Maturité ne recule jamais. |
| FR-011 | S2 | Coup de Cœur — monnaie sociale rare, quota mensuel par stade (1→3) +1 Gold, reset le 1er du mois. |
| FR-012 | S2 | Archétypes & mues — attribution auto parmi 5 MVP dérivée des 2 axes dominants ; mue si axes stables 30 j + 5 spots nouvelle direction. |
| FR-013 | S1 | Recherche & filtres — texte (nom/cuisine/quartier) + filtres combinables AND, résultats <1,5s 3G. |
| FR-014 | S2 | Carte interactive — pins, zoom, filtre catégorie, fiche au tap, deep link navigation, style dark, paywall visuel. |
| FR-015 | S2 | Paywall géographique — gratuit = rayon 3 km, hors zone flouté ; Gold = tout Abidjan. Nudge non bloquant. |
| FR-016 | S1 | Partage WhatsApp — deep link sortant (image, nom, note, lien), redirection store si app absente. |
| FR-017 | S2 | Signalement & modération — bouton Signaler, file admin, décision humaine garder/supprimer/warning/ban. |
| FR-018 | S2 | Création modérée de fiche lieu — suggestion spawter (nom/adresse/type), validation équipe sous 7 j ouvrés. |
| FR-019 | S2 | Notifications push & locales — 6 types, Le Guet locale offline, push serveur <30s P95, préférences configurables. |
| FR-020 | S2 | Souscription Spawter Gold — 2 500 F HT/mois ou 25 000 F HT/an via CinetPay (Orange Money/Wave/MTN MoMo), activation immédiate. |
| FR-021 | S2 | Gestion d'abonnement avec grace period — rappels J-3/J, grace 7 j, downgrade auto J+8, données conservées 90 j masquées. |
| FR-022 | S2 | Émission de facture conforme — facture séquentielle `SPAWT-2026-NNNN` par email+SMS <30s, TVA 18%, table `invoices`. |
| FR-023 | S1 | Panel admin web — CRUD lieux, modération, gestion comptes, métriques basiques ; accès `spawt_staff` uniquement, actions critiques auditées. |
| FR-024 | S1 | Collecte de signaux append-only — table `user_signals` (9 types), aucune mutation, rétention infinie V1. |
| FR-025 | S1 | Mise à jour du Palais par décroissance exponentielle — `facteur = max(0,05, 1/(1+n_spots×0,05))`, recalcul incrémental, mapping §20.5. |
| FR-026 | S1 | Mise à jour de l'ADN du Lieu — par sous-critères + tags mappés 5 axes ; avis `is_seed` alimentent l'ADN mais exclus du compteur public ; `confidence_score`. |
| FR-027 | S1 | Séparation `spawters` / `spawt_staff` — comptes B2C vs équipe interne ; toutes les FK pointent vers `spawters(id)`. |
| FR-028 | S1 | Table commerciale `customers` — entité commerciale séparée de `spawters` ; `subscriptions`/`invoices` référencent `customers.id`. |
| FR-029 | S1 | Catalogue de plans tarifaires — table `plans` (code, label, price_ht, currency_id, country_code, period, is_active) ; `subscriptions.plan_id` FK. |
| FR-030 | S1 | Catalogue de devises multi-pays — table `currencies` ; seed XOF actif, hooks de conversion inactifs V1. |
| FR-031 | S1 (Phase 0) | Système de tokens design — fichier source unique (CSS vars + JSON Figma), aucune couleur en dur ; palette + typos PRD §15. |
| FR-032 | S1 (Phase 0-4) | Pré-chargement inventaire initial + avis fondateurs — 50-100 lieux dont 20 Mission 1, 3 avis seed/lieu (`is_seed=true`), carte jamais vide. |
| FR-033 | S2 | Suppression de compte & export self-service — soft-delete + anonymisation J+30, export JSON. (Imposé Loi 2013-450 indép. statut amendement.) |
| FR-034 | S2 | Application des sanctions Faux-Pas — Warning/BAN par `spawt_staff` selon Faux-Pas, table d'audit. |
| FR-035 | S1 | Badge `Premier Spawt` (verrou activation) — attribué <5s après premier spawt vérifié, déverrouille les avis détaillés. |
| FR-036 | S2 | Badges spéciaux du lieu — calcul batch quotidien (Coup de Cœur, Pépite Vérifiée, Institution, etc.) affiché sur fiche. |
| FR-037 | S1 | Note communautaire pondérée — `Σ(note×poids_stade)/Σ(poids_stade)`, recalcul incrémental, affichage étoiles. |
| FR-038 | S2 | Interface de paiement abstraite — `IPaymentProvider` (initiate/getStatus/confirm/refund/parseWebhook), CinetPay V1, swap testé. |
| FR-039 | S1 | Stockage local des spawts en attente de synchronisation — file locale offline, sync auto au retour réseau, inspectable/purgeable. |
| FR-040 | S1 (bloquant) | Écran de consentement ARTCI à l'onboarding — 2 cases non pré-cochées (CGU/CGV + géoloc/PII), historisé `cgv_accepted_at`/`geoloc_consent_at`, révocable. |
| FR-041 | S1 (Phase 0) | Système de feature flags — table `feature_flags`, hook `useFlag`, 4 scopes (internal/alpha/beta/prod), ciblage spawter, TTL <60s. |

**Total FRs: 41** (27 Sprint 1, 14 Sprint 2). Note: the Sprint 1 scope = 12 of 19 PRD features; several Sprint-1-phased FRs are data/infra enablers (FR-024..FR-032, FR-040, FR-041).

### Non-Functional Requirements

41 NFR entries extracted across 11 categories.

**Performance — temps de réponse**
- NFR-PERF-01: feed (FR-004) < 3 s P95 sur 3G (Sentry, Android mid-range).
- NFR-PERF-02: fiche lieu (FR-005) < 2 s P95 sur 3G.
- NFR-PERF-03: persistance spawt (FR-006) < 500 ms P95 confirm→ACK backend.
- NFR-PERF-04: notif Le Guet < 30 s du trigger geofencing (si réseau).

**Performance — taille et bundle**
- NFR-PERF-05: APK installé < 50 MB (Google Play Console).
- NFR-PERF-06: bundle JS initial < 500 KB gzippé.
- NFR-PERF-07: photos compressées 80% / 1 MB max par image.

**Géolocalisation**
- NFR-GEO-01: périmètre détection Le Guet = 10 m.
- NFR-GEO-02: précision GPS < 30 m requise pour spawt vérifié, sinon mode manuel.
- NFR-GEO-03: moyenne des 3 dernières positions GPS sur 30 s avant trigger.
- NFR-GEO-04: désactivation GPS + mode manuel si batterie < 10%.

**Disponibilité et résilience**
- NFR-AVAIL-01: 99,9% uptime backend public en heures ouvrées (08:00-22:00 GMT).
- NFR-AVAIL-02: spawts mis en file offline, sync < 60 s au retour réseau.
- NFR-AVAIL-03: tolérance à la terminaison background OEM Android, latence réveil ≤ 5 min.

**Conformité et sécurité**
- NFR-SEC-01: RLS sur toutes les tables contenant des PII spawter.
- NFR-SEC-02: consentement explicite avant activation géoloc (timestamp + écran bloquant).
- NFR-SEC-03: TLS 1.2+ pour toute communication client-serveur.
- NFR-SEC-04: soft-delete compte < 5 s, anonymisation PII < 30 j.

**Anti-fraude**
- NFR-FRAUD-01: rejet spawt même lieu < 4 h (SQL trigger).
- NFR-FRAUD-02: flag > 5 spawts/jour (SQL trigger).
- NFR-FRAUD-03: flag déplacement > 100 km/h entre 2 spawts (SQL trigger).
- NFR-FRAUD-04: poids 0,5x si `is_verified = false`.
- NFR-FRAUD-05: flag compte si 10+ patterns identiques sur 7 j glissants (batch quotidien).
- NFR-FRAUD-06: flag si `left_at - arrived_at < 5 min` ET check-in actif.

**Observabilité**
- NFR-OBS-01: crash-free session rate > 99% (Sentry, 7 j glissants).
- NFR-OBS-02: événements funnel AARRR dans Mixpanel/PostHog avec cohort tracking.
- NFR-OBS-03: capture des 9 types de signaux dans `user_signals`.
- NFR-OBS-04: `documentation/analytics/events.md` = single source of truth pour les events (EVT-XX), aucun event ad-hoc.

**Internationalisation**
- NFR-I18N-01: 100% des strings UI extraites (i18next, `fr-CI`), build échoue sur string FR en dur (`npm run i18n:check`).
- NFR-I18N-02: audit vocabulaire (`npm run lint:vocab`) bloquant sur tout terme hors glossaire.

**Architecture portable (multi-villes)**
- NFR-PORT-01: ajout d'une ville sans refactoring (colonne `country_code`), un spawter peut être Guide dans une ville et Touriste dans une autre.

**Capacité et charge**
- NFR-CAP-01: 15 000 MAU (cible M12) dans les bornes NFR-PERF-01..04.
- NFR-CAP-02: 500 spawts/jour + 200 avis/jour à M12 sans dégradation.
- NFR-CAP-03: 800 lieux servis avec requêtes feed sub-seconde à M12.

**Coûts opérationnels**
- NFR-COST-01: plafond coûts Mapbox via tile caching + rate limiting.
- NFR-COST-02: coûts Cloudinary minimisés (compression 1 MB + lazy loading).

**Conservation et migration data**
- NFR-DATA-01: `user_signals` append-only strict (trigger Postgres anti-UPDATE/DELETE).
- NFR-DATA-02: données premium conservées 90 j masquées après downgrade.
- NFR-DATA-03: politique overwrite sur `user_palais`/`spawter_progression`, trajectoire historique via `collection_titres` + `user_signals`.

**Paiement Mobile Money**
- NFR-PAY-01: confirmation paiement CinetPay < 60 s pour 95% des transactions.
- NFR-PAY-02: fallback provider de paiement sans refactoring via `IPaymentProvider`.

**Total NFRs: 41** (le PRD annonce 40 ; l'écart est cosmétique — comptage de catégories vs entrées).

### Additional Requirements

- **Domain Requirements (DR) — 24 entrées :** DR-ARTCI-01..05 (régulation données CI, Loi 2013-450), DR-BCEAO-01..02 (Mobile Money, pas d'agrément propre), DR-TVA-01..04 (TVA 18%, facturation séquentielle), DR-CGV-01..07 (checklist juriste `[pending juriste]` : droit applicable, rétractation, résiliation Gold, remboursement Mobile Money, PI UGC, modération, juridiction Abidjan), DR-FRAUD-01..06 (anti-fraude Le Guet).
- **Project-Type Requirements (PTR) — 20 entrées :** PTR-PLAT-01..03 (iOS+Android+admin web, pas de site V1), PTR-DEV-01..04 (matrice devices Android low/mid + iPhone, APK <50 MB, offline-tolerant), PTR-CAP-01..06 (géoloc background, push, caméra, deep linking, stockage local, i18n), PTR-OPS-01..03 (OEM Android background-kill, batterie <10%, carte dark), PTR-STORE-01..04 (Apple Guidelines, Google Play, manifest permissions, age rating 17+).
- **Success Criteria (SC) — 23 métriques SMART :** SC-ACQ (3), SC-ACT (3), SC-RET (3), SC-REF (3), SC-REV (5), SC-INV (4) — outcomes business traçables au funnel AARRR et à la distribution des stades M12.
- **5 User Journeys** explicitement tracés aux FRs (Onboarding/Palais, Découverte→Spawt, Avis post-spawt, Identité spawter, Upgrade Gold).
- **8 décisions historisées à trancher avant kickoff** (project-context §Décisions) — provider analytics, framework E2E, formules KPIs, etc.

### PRD Completeness Assessment

**Strengths:**
- Exceptionally well-structured for downstream BMAD consumption: every FR/NFR carries an explicit `Source` PRD §reference and a `Phase` field; an Annexes traceability section maps FR/NFR ↔ PRD source and ↔ code artifact locations.
- Requirements are testable — NFRs follow the `shall [metric] [condition] [measurement method]` template; FRs carry quantified acceptance criteria.
- Innovation, domain/regulatory (ARTCI/BCEAO/TVA/CGV), and store-compliance dimensions are explicitly covered — uncommon completeness for a V1 PRD.
- The 8 Claude amendments are fully dispositioned (6 translated into FR-040, FR-041, NFR-OBS-04, NFR-I18N-01/02, FR-026/FR-032 amended).

**Gaps / watch-items to carry into epic-coverage validation:**
1. **`[pending]` / `[pending juriste]` items:** DR-CGV-01..07 await a legal reviewer; the 8 Claude amendments await formal triple sign-off (Stéphanie + Kidam + Alexandre). Implementation can proceed (the FRs are accepted V1) but the legal wording is unresolved.
2. **8 historized decisions** not yet settled (analytics provider PostHog vs Mixpanel — note NFR-OBS-02 lists both; E2E framework; KPI formulas; device allocation). Epics must not silently pick one.
3. **Sprint 1 vs Sprint 2 split:** 13 FRs are Sprint 2 — epic-coverage validation must confirm whether the epics cover the full 41-FR scope or only the Sprint 1 subset, and that this is intentional.
4. **FR-031 token palette discrepancy (potential conflict):** PRD §15.1 cited in FR-031 lists Or SPAWT `#D4AF37`, Instrument Serif / Manrope / JetBrains Mono — but the project memory (`project_spawt_ux_canonical`) and the recent commit `refactor(theme): réaligne tokens.ts sur le brandbook canonique` indicate the canonical brand is Or `#C8A44E`, Klinsman / Gotham. The UX spec (`ux-design-specification.md`) supersedes PRD §15 per memory. **This must be reconciled during UX validation (step covering UX) — the PRD's own token values appear stale.**
5. **NFR count:** PRD self-reports 40 NFRs; 41 distinct NFR-IDs are present. Cosmetic, noted for accuracy.

Overall: **PRD is implementation-grade and traceability-ready.** No blocking ambiguity for requirements extraction; the watch-items above are inputs to coverage validation, not PRD defects.

---

## Epic Coverage Validation

**Source:** `epics.md` — BMAD Epic Breakdown, explicitly scoped to **Sprint 1 V1 = 12 prioritized features (cahier §3.1)**. The document inventories all 41 FRs but, by design, decomposes into epics + stories only the 27 Sprint 1 FRs. The 14 Sprint 2 FRs are listed for traceability and explicitly marked out of scope.

**Structure:** 6 epics, 35 stories total.
- Epic 1 — Fondation canonique & schéma de données (8 stories)
- Epic 2 — Entrée dans la Meute — auth, consent & calibrage (6 stories)
- Epic 3 — Découverte — Home, feed, fiche lieu, recherche & favoris (7 stories)
- Epic 4 — Le Spawt — Le Guet, avis structuré & apprentissage du Palais (7 stories)
- Epic 5 — Identité du spawter — profil, Palais radar & stades (4 stories)
- Epic 6 — Panel admin & opération de contenu (5 stories)

### Coverage Matrix

| FR | Phase | Epic Coverage | Story-level path | Status |
|---|---|---|---|---|
| FR-001 | S1 | Epic 2 | Story 2.3 (Auth OTP + Google/Apple Sign-In) | ✓ Covered |
| FR-002 | S1 | Epic 2 | Stories 2.4 (profil/PII), 2.5 (calibrage 5 questions), 2.6 (Palais initial + titre) | ✓ Covered |
| FR-003 | S1 | Epic 2 | Story 2.1 (Voix du Chat — `chat-voice.ts`), reused in 2.6 | ✓ Covered |
| FR-004 | S1 | Epic 3 | Story 3.3 (HomeD + feed + score composite `matching.ts`) | ✓ Covered |
| FR-005 | S1 | Epic 3 | Story 3.4 (Fiche lieu détaillée) | ✓ Covered |
| FR-006 | S1 | Epic 4 | Stories 4.1 (armement/geofence/GuetIndicator), 4.2 (notif/snooze/confirmation) | ✓ Covered |
| FR-007 | S1 | Epic 4 | Story 4.5 (Avis structuré post-spawt) | ✓ Covered |
| FR-008 | S1 | Epic 5 | Stories 5.2 (collection titres + titre affiché), 5.3 (profil + carte spawter + radar) | ✓ Covered |
| FR-009 | S1 | Epic 3 | Story 3.6 (Sauvegarde de lieux / favoris) | ✓ Covered |
| FR-010 | S1 | Epic 5 | Stories 5.1 (progression stades + recompute), 5.4 (célébration de stade) | ✓ Covered |
| FR-011 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-012 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-013 | S1 | Epic 3 | Story 3.5 (Recherche & filtres) | ✓ Covered |
| FR-014 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-015 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-016 | S1 | Epic 3 | Story 3.7 (Partage WhatsApp) | ✓ Covered |
| FR-017 | S2 | — | Inventoried; Story 6.4 explicitly notes signalement-queue wiring deferred to S2 | ⏸ Deferred (Sprint 2) |
| FR-018 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-019 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-020 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-021 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-022 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-023 | S1 | Epic 6 | Stories 6.1 (auth/shell), 6.2 (CRUD lieux), 6.4 (modération/comptes), 6.5 (métriques) | ✓ Covered |
| FR-024 | S1 | Epic 1 | Story 1.7 (`user_signals` append-only + wrapper analytics typé) | ✓ Covered |
| FR-025 | S1 | Epic 4 | Story 4.6 (Apprentissage du Palais — `palais-engine.ts`) | ✓ Covered |
| FR-026 | S1 | Epic 4 | Story 4.7 (Mise à jour de l'ADN du Lieu) | ✓ Covered |
| FR-027 | S1 | Epic 1 | Story 1.5 (Schéma `spawters`/`spawt_staff` + RLS) | ✓ Covered |
| FR-028 | S1 | Epic 1 | Story 1.6 (Schéma `customers`/`plans`/`currencies`) | ✓ Covered |
| FR-029 | S1 | Epic 1 | Story 1.6 (`plans` table + seed `gold_monthly`/`gold_annual`) | ✓ Covered |
| FR-030 | S1 | Epic 1 | Story 1.6 (`currencies` table + seed XOF) | ✓ Covered |
| FR-031 | S1 | Epic 1 | Story 1.1 (Réalignement tokens canoniques) | ✓ Covered |
| FR-032 | S1 | Epic 6 | Story 6.3 (Pré-chargement inventaire + avis fondateurs `is_seed`) | ✓ Covered |
| FR-033 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-034 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-035 | S1 | Epic 4 | Story 4.2 (Badge `Premier Spawt` au 1er spawt vérifié) | ✓ Covered |
| FR-036 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-037 | S1 | Epic 3 | Story 3.2 (Note communautaire pondérée par stade) | ✓ Covered |
| FR-038 | S2 | — | Inventoried, not decomposed (out of scope) | ⏸ Deferred (Sprint 2) |
| FR-039 | S1 | Epic 4 | Story 4.3 (Offline queue des spawts & résilience réseau) | ✓ Covered |
| FR-040 | S1 | Epic 2 | Story 2.2 (Splash + écran de consentement ARTCI bloquant) | ✓ Covered |
| FR-041 | S1 | Epic 1 | Story 1.8 (Système de feature flags runtime) | ✓ Covered |

**FRs in epics but NOT in PRD:** None. The epics' Requirements Inventory mirrors the PRD's 41 FRs exactly (same IDs, same text, same phases).

### Missing Requirements

**No unplanned gaps within the declared scope.** Every one of the 27 Sprint 1 FRs has both an epic mapping *and* concrete story-level coverage with Gherkin acceptance criteria.

The 14 "uncovered" FRs (FR-011, FR-012, FR-014, FR-015, FR-017–FR-022, FR-033, FR-034, FR-036, FR-038) are **intentionally deferred to Sprint 2** — this is a documented, sourced scope decision (`cahier §3.1` freezes Sprint 1 = 12 of 19 features), not an oversight. They are fully inventoried in `epics.md` for traceability.

**Watch-items (not gaps, but to confirm before Phase 4):**
1. **Scope of this readiness assessment.** The epics document targets Sprint 1 only. This implementation-readiness check should therefore be understood as gating **Sprint 1 implementation**, against which FR coverage is **100% (27/27)**. If the intent is to gate the full V1 PRD, then 14 FRs have no epics/stories yet — but that would contradict the cahier's frozen scope. **Recommended: treat Sprint 1 as the implementation target;** Sprint 2 epics are a separate future planning artifact.
2. **Sprint 2 FR-017 partial touch-point.** Story 6.4 builds the moderation queue but explicitly leaves the mobile "Signaler" button → queue wiring for Sprint 2. Clean boundary, just noted so it isn't mistaken for a Sprint 1 deliverable.
3. **Cross-cutting FRs spanning multiple stories** (FR-002 → 3 stories, FR-006 → 2, FR-008 → 2, FR-010 → 2, FR-023 → 4): decomposition is sound, but story-quality review (later step) should confirm no acceptance criterion falls between the seams.
4. **Foundation epic (Epic 1) carries UX-DR1–6 and several NFRs** in its header but its FR set is data/infra only — the UX-driven stories (1.1–1.4) are correctly story-fied even though they trace to UX-DRs rather than FRs. Good practice; flagged so the UX-alignment step picks them up.

### Coverage Statistics

- **Total PRD FRs:** 41
- **FRs in declared Sprint 1 scope:** 27
- **Sprint 1 FRs covered by epics + stories:** 27
- **Sprint 1 coverage:** **100% (27/27)**
- **FRs intentionally deferred to Sprint 2 (inventoried, no stories):** 14
- **Full-PRD coverage:** 65.9% (27/41) — by design, per the frozen Sprint 1 scope
- **FRs in epics but absent from PRD:** 0
- **Total epics:** 6 · **Total stories:** 35

---

## UX Alignment Assessment

### UX Document Status

**Found** — `ux-design-specification.md` (96 KB, `status: complete`, all 14 workflow steps done, dated 2026-05-14). Scoped to **Sprint 1 V1 — the same 12 prioritized features** as the PRD and epics. The document is exceptionally complete: personas + emotional design, 4 user journeys with Mermaid flows, component strategy built on the canonical `documentation/ux/midfi-kit.jsx`, consistency patterns, accessibility (UX-DR28) and responsive (UX-DR29) requirements.

Architecture (`architecture.md`) explicitly lists `ux-design-specification.md` as input document #5 and was authored the same day — it is built *on top of* the UX spec, not in parallel to it.

### UX ↔ PRD Alignment

**Strong and deliberate.** The UX spec opens with a **"Canonical Sources & Reconciliation"** section that explicitly resolves 11 drifts (D1–D11) between the `documentation/ux/` kit and the PRD/Contrat. Where the kit and the PRD disagree, the resolutions defer to the PRD: D1 (OTP-only, not email/password), D6 (copy "Le Guet" not "VTC"), D7 (5-star not 4-star rating), D8 (canonical Palais axes). The UX traces individual screens and components to FR/NFR IDs throughout (FR-006, FR-008, FR-040, NFR-PERF-01, etc.). The epics' UX-DR1–31 are a faithful, story-ready projection of this spec.

**No UX requirement is absent from the PRD.** The reverse — PRD content the UX consciously overrides — is the alignment story here, and it is *managed*, not accidental.

### UX ↔ Architecture Alignment

**Strong.** The architecture supports every structural UX decision:
- **Navigation & IA:** 5-tab nav + central FAB, `HomeD` home, `(onboarding)`/`(tabs)` route groups, passive `RouteGuard` — all reflected in the architecture's directory structure and Frontend Architecture section.
- **Design system:** `tokens.ts` realigned to `spawt-tokens.css`, Klinsman + Gotham via `expo-font`, `midfi-kit` primitives ported to RN, **no third-party UI framework** — and the architecture justifies the no-framework choice with the very same NFR-PERF-06 (<500 KB bundle) the UX cites.
- **Animation:** `react-native-reanimated` on the UI thread — matches the UX component strategy's needs (card flip, `GuetIndicator` pulse, carousel).
- **Le Guet:** architecture adds `expo-task-manager` for OS-level geofence persistence — directly enables UX Critical Success Moment #1 and the `GuetIndicator`, and the OS-kill survival the UX flags as defi #10.
- **Edge cases:** mode-démo manual CTA, offline queue, "En construction", GPS/battery fallbacks — all present in both documents with consistent behavior.

### Alignment Issues

1. **⚠️ PRD §15 / FR-031 carry a stale design palette — not yet amended (Medium).** The UX spec, epics (Story 1.1 / UX-DR1), and project-context all treat `documentation/ux/` as the canonical brand source and explicitly state PRD §15.1/§15.3 must be amended. But **the PRD document itself still has not been updated**: FR-031's acceptance criteria still cite Or `#D4AF37`, Instrument Serif / Manrope / JetBrains Mono. An implementer reading FR-031 literally would build the wrong palette. Mitigation: Story 1.1 and project-context carry the *correct* canonical values (Or `#C8A44E`, Klinsman/Gotham), and the recent commit `refactor(theme): réaligne tokens.ts sur le brandbook canonique` has already started the realignment. **Recommendation: amend PRD §15.1/§15.3 + FR-031 acceptance, or add an explicit erratum note in the PRD, before Phase 4 — so the PRD stops contradicting its own downstream artifacts.**
2. **⚠️ UX Platform Strategy table says "Admin panel React → V1.5" — contradicts Sprint 1 scope (Low).** FR-023 is Sprint 1 in the PRD, Epic 6 is Sprint 1 in the epics, and the architecture sequences the Refine admin in Sprint 1. The UX spec's parenthetical "→ V1.5" is stale/incorrect. Substance is fine — the admin panel is not user-facing and correctly needs no mobile UX design — but the note should be corrected so the documents agree on scope.
3. **PRD copy amendment pending for D6** — UX flags "PRD/data-models à amender" for the Le Guet notification copy ("VTC" → "Le Guet"). Minor; bundled with issue #1's PRD-amendment pass.

### Warnings

- **D2/D3 ("paws" / "reconnaissances") kept under guardrails — a dedicated Contrat review is a declared prerequisite for Epic 5.** The UX spec keeps both concepts but only "non-convertible" / "non-public", and explicitly says their Contrat §20.1 compliance "depends strictly on respecting these guardrails" — flagging a brand/Contrat session to be scheduled *before* identity/profile code. Epics carry this as UX-DR23 and Story 5.2. **This is an open governance gate on Epic 5, not a design gap.**
- **D5 favorites rename is unresolved** — "Mes spots" / "Ma liste" proposed but not fixed; Story 3.6 carries the same open naming. Needs a naming decision (non-blocking, but should be settled before Story 3.6).
- **No Sprint 2 UX exists** — consistent with the epics and the frozen cahier scope. Acceptable for a Sprint 1 readiness gate; noted so it isn't mistaken for a gap. Sprint 2 features (Coup de Cœur, carte, paywall, paiement, archétypes/mues) have neither epics nor UX yet.
- **Accessibility & responsive are specified but carry an open action** — UX-DR28 mandates a **WCAG 2.1 AA contrast re-validation** on the canonical palette (Or `#C8A44E` + Vert Chat `#2D6B4F` on `#FAFAF8` and on `gr-night`). This re-validation has not yet been performed and is a Phase 0 prerequisite (also ties to the missing `--alert-red` token, UX-DR2).

**Overall:** UX is implementation-grade, fully reconciled with the PRD, and fully supported by the architecture. The single item worth acting on before Phase 4 is **amending the PRD** so §15/FR-031 stop contradicting the canonical UX kit that every other artifact already follows.

---

## Epic Quality Review

Reviewed all **6 epics / 35 stories** against `create-epics-and-stories` standards: user-value focus, epic independence, story sizing, forward dependencies, just-in-time table creation, AC quality, starter-template handling, FR traceability.

### What is done well (no defect)

- **No forward epic dependencies.** Dependency graph is strictly backward: Epic 2→1, Epic 3→1+2, Epic 4→1+2, Epic 5→1+4, Epic 6→1+(3). No epic requires a later epic to function.
- **Just-in-time table creation — correctly applied.** Epic 1 creates *only* foundation entities; `places`/`place_adn` are created in Story 3.3, `user_palais` in 2.5, `spawt_checkin` in 4.1, `spawter_progression` in 5.1, `collection_titres` in 5.2 — each table created in the epic that first needs it. This is the prescribed pattern, not the "Epic 1 creates all tables" anti-pattern.
- **Acceptance criteria are high quality** — consistent Given/When/Then BDD, quantified and testable (`<500ms`, `<3s P95`, `<30s`), error/edge cases explicitly covered (offline, demo mode, GPS imprecise, onboarding abandon, `confidence < 0.3`), analytics events named per `events.md`.
- **Brownfield handled correctly** — Epic 1 is an alignment/integration epic, not a bootstrap; consistent with the architecture's "AUCUN starter" for `app/`.
- **Full FR traceability** maintained (FR Coverage Map + per-epic "FRs covered").

### 🔴 Critical Violations

**None.** No technical-milestone epic that lacks any user, no epic-sized un-completable story, no forward dependency.

### 🟠 Major Issues

1. **Epic 6 dependency is mis-declared.** Epic 6 states *"Autonome — ne dépend que du schéma de l'Epic 1"*, and `architecture.md` repeats *"Le panel admin (Epic 6) ne dépend que du schéma Epic 1 — autonome."* This is **factually wrong**: Story 6.2 (CRUD lieux) and Story 6.3 (pré-chargement inventaire) operate on `places` / `place_adn`, which are created in **Epic 3 Story 3.3**. The dependency itself is backward (Epic 6 after Epic 3) and therefore legal — but the *declared* independence invites someone to start Epic 6 right after Epic 1 and hit missing tables. **Remediation:** either move the `places`/`place_adn` migration into Epic 1, or give Epic 6 its own places-schema story, or correct the dependency statement to "Epic 1 + the `places`/`place_adn` migration" in both `epics.md` and `architecture.md`.
2. **Story 6.1 omits the Refine starter initialization the architecture mandates.** `architecture.md` explicitly states: *"L'initialisation via `npm create refine-app@latest -- --preset refine-supabase spawt-admin` doit être la première story d'implémentation de l'Epic 6."* But Story 6.1 ("Authentification & shell du panel admin") jumps straight to auth + nav shell — its ACs contain no project-bootstrap step (scaffold, dependencies, `supabaseClient` wiring). **Remediation:** add the starter-init as the first AC block of Story 6.1 (or a dedicated Story 6.0).
3. **Story 3.3 is oversized.** "Lieux, adapter data-source & Home HomeD avec feed personnalisé" bundles, in one story: the `places`/`place_adn` migration + RLS, the `data-source` adapter (dynamic import + fallback), the full `HomeD` UI (masthead + `ModeStories` + `UneCarousel`), the `matching.ts` composite-score engine, and feed perf (`≥10 lieux`, P95 `<3s`). That is ~3 stories of scope (data layer / adapter / Home UI + scoring). **Remediation:** split into e.g. 3.3a `places`/`place_adn` schema + data-source adapter, 3.3b composite-score engine (`matching.ts`, pure fn), 3.3c `HomeD` + feed UI.

### 🟡 Minor Concerns

1. **Epic 1 is a foundation/technical epic.** "Fondation canonique & schéma de données" delivers no end-spawter value on its own — normally a red flag. Here it is an **explicitly acknowledged brownfield foundation exception** (the epic states *"exception « fondation » assumée"*) and is justified by the architecture's dependency analysis. Accepted; flagged only for visibility.
2. **`customers` / `plans` / `currencies` created in Sprint 1 but consumed by no Sprint 1 story.** Story 1.6 builds the commercial-entity tables; their first consumer is FR-020 (paiement, Sprint 2). This is sourced to PRD phasing (FR-028/029/030 are PRD-phased Sprint 1) + NFR-PORT-01, so it is deliberate — confirm the team consciously wants this foundation laid in Sprint 1 rather than deferred.
3. **Story 2.6 redirects to `HomeD` (Epic 3).** Benign cross-epic navigation target, but Epic 2 is not fully demoable end-to-end without at least a `(tabs)` shell stub. Story 3.1 already plans `EmptyState` tabs — note the sequencing so Epic 2's exit point is testable.
4. **Within Epic 3, Story 3.2's persistence AC depends on Story 3.3.** Story 3.2 (note pondérée) is mostly a pure function (independent), but one AC writes to `place_adn.weighted_rating` — a table created in Story 3.3. Sequence 3.2 after 3.3, or split the pure-function part from the persistence wiring.
5. **Favorites (Story 3.6 / FR-009) have no persistence schema.** Story 3.6 specifies local-first store behavior only; no `favorites`/`saved_places` table appears in the 15-table list and no migration is referenced. Confirm whether favorites are AsyncStorage-only in Sprint 1 or need a server table + sync target.
6. **No CI/CD setup story.** `.github/workflows/mobile-ci.yml` is a stated target but no story owns it. Acknowledged as deferred (triple-gate-local is the interim barrier) — acceptable for Sprint 1, noted for completeness.
7. **Minor AC format mixing** — some trailing `And …` lines carry scope decisions (e.g. "le `HomeContextuel` est reporté V1.5") rather than testable criteria. Cosmetic; consider moving scope notes out of the Gherkin block.

### Best-Practices Compliance Checklist

| Check | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 |
|---|---|---|---|---|---|---|
| Delivers user value | ⚠️ foundation exception | ✓ | ✓ | ✓ | ✓ | ✓ (internal user) |
| Functions independently (backward deps only) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (dep mis-declared) |
| Stories appropriately sized | ✓ | ✓ | ⚠️ 3.3 oversized | ✓ | ✓ | ✓ |
| No forward dependencies | ✓ | ⚠️ 2.6→HomeD (nav) | ⚠️ 3.2→3.3 (within-epic) | ✓ | ✓ | ✓ |
| Tables created when needed | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ relies on 3.3's tables |
| Clear acceptance criteria | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FR traceability maintained | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Starter-template story present | n/a (brownfield) | n/a | n/a | n/a | n/a | ⚠️ missing in 6.1 |

**Summary:** 0 critical, 3 major, 7 minor. The epic breakdown is structurally sound — the three Major issues are all **localized and cheaply fixable** (correct one dependency statement / relocate one migration, add one AC block to Story 6.1, split one oversized story). None block the *content* of Sprint 1; all three should be resolved before story execution begins so sequencing and the admin-panel bootstrap are unambiguous.

---

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK — minor remediation, no blockers.**

SPAWT Sprint 1 is **substantively ready** for Phase 4. The four planning artifacts (PRD, UX spec, architecture, epics) are unusually mature, mutually traceable, and were authored as a coherent chain — the architecture explicitly consumes the UX spec and epics; the epics mirror the PRD's 41 FRs exactly. Sprint 1 FR coverage is **100% (27/27)**, every Sprint 1 FR has story-level Gherkin acceptance criteria, and there are **zero critical defects** across all five assessment dimensions.

It is **not** a clean "READY" only because of a short list of **cheap, localized corrections** — a stale PRD section, three structural epic-doc fixes, and a few open governance gates — that should be cleared before story execution so implementers are not working from self-contradicting documents.

### Critical Issues Requiring Immediate Action

There are **no critical (🔴) issues**. The following are the **highest-priority items** to clear before Phase 4:

1. **PRD §15 / FR-031 carry a stale design palette (UX alignment — Medium).** The PRD still cites Or `#D4AF37` + Instrument Serif/Manrope; the canonical brand (UX spec, epics Story 1.1, project-context, and the already-merged `tokens.ts` realignment commit) is Or `#C8A44E` + Klinsman/Gotham. An implementer reading FR-031 literally builds the wrong brand. → **Amend PRD §15.1/§15.3 + FR-031 acceptance, or add an erratum note.**
2. **Epic 6 dependency is mis-declared (Epic quality — Major).** Both `epics.md` and `architecture.md` say Epic 6 "ne dépend que du schéma de l'Epic 1", but Stories 6.2/6.3 need `places`/`place_adn` (created in Epic 3 Story 3.3). → **Move the `places`/`place_adn` migration to Epic 1, or correct the dependency statement in both docs.**
3. **Story 6.1 omits the Refine starter init the architecture mandates (Epic quality — Major).** → **Add the `npm create refine-app` bootstrap as the first AC block of Story 6.1 (or a Story 6.0).**
4. **Story 3.3 is oversized (Epic quality — Major).** Bundles schema + adapter + Home UI + scoring engine + feed perf. → **Split into ~3 stories.**

### Recommended Next Steps

1. **Run a one-pass PRD erratum** covering issue #1 (palette/typography §15 + FR-031), the D6 copy fix ("VTC" → "Le Guet"), and the UX Platform-Strategy "admin → V1.5" inaccuracy — all are known, decided, and just need the PRD text updated to match its downstream artifacts.
2. **Apply the three Major epic-doc fixes** (Epic 6 dependency + places migration placement, Story 6.1 starter init, Story 3.3 split) so epic sequencing and the admin bootstrap are unambiguous before story execution.
3. **Close the open governance gates the artifacts themselves flag:** (a) triple sign-off (Stéphanie + Kidam + Alexandre) on the 8 Claude amendments — already implemented as accepted FRs but not formally signed; (b) the dedicated Contrat §20.1 review of D2/D3 ("paws"/"reconnaissances") — a declared prerequisite for Epic 5; (c) the WCAG 2.1 AA contrast re-validation on the canonical palette (UX-DR28) + the missing `--alert-red` token (UX-DR2) — Phase 0 prerequisites.
4. **Settle the small open decisions before they reach a story:** favorites persistence schema (FR-009 / Story 3.6), the favorites rename "Mes spots"/"Ma liste" (D5), and confirm the conscious choice to lay `customers`/`plans`/`currencies` in Sprint 1. The 8 historized decisions (analytics provider, E2E framework, KPI formulas, `session_duration_minutes`, device allocation, legal budget) remain owner-assigned — agents must not resolve them unilaterally.
5. **Treat the `[pending juriste]` items (DR-CGV-01..07)** as a parallel legal workstream — they do not block code (the FRs are accepted V1) but the consent/CGV *wording* must land before public beta.

### Final Note

This assessment reviewed 4 planning artifacts across 5 dimensions (document discovery, PRD analysis, epic coverage, UX alignment, epic quality) and identified **15 issues**: **0 critical, 4 major** (1 UX-Medium + 3 epic-quality-Major), **and 11 minor / warnings / watch-items**. No issue blocks the content of Sprint 1, and Sprint 1 FR coverage is complete at 100%. Address the highlighted items — primarily a PRD erratum pass and three localized epic-doc corrections — to remove the self-contradictions implementers would otherwise hit, then Phase 4 can proceed. The artifacts may also be used as-is at the team's discretion; the findings above are improvement guidance, not gates the tooling enforces.

---

**Assessment date:** 2026-05-14
**Assessor:** Implementation Readiness workflow (BMAD `bmad-check-implementation-readiness`), facilitated for Alexandre
**Artifacts assessed:** `PRD.md` · `architecture.md` · `epics.md` · `ux-design-specification.md`
**Scope:** Sprint 1 V1 — 12 prioritized features (cahier §3.1)

---

## Remediation Log (2026-05-14, post-assessment)

The highest-priority findings were remediated the same day, immediately after this assessment:

| Finding | Action taken | Artifact |
|---|---|---|
| UX-alignment Medium — stale PRD §15 / FR-031 palette | **Resolved.** `bmad-edit-prd` erratum pass → PRD **v1.0.3**: FR-031 acceptance realigned to canonical palette (`#C8A44E`, Klinsman/Gotham), canonical brand block added to Annexes, `§`-reference convention note added, "VTC" vocab-drift documented, NFR/DR counts corrected (41/24). | `PRD.md` |
| UX-alignment Low — "admin → V1.5" inaccuracy | **Resolved.** Platform Strategy table corrected: admin panel is Sprint 1 (FR-023/Epic 6), non-user-facing. | `ux-design-specification.md` |
| Epic-quality Major #1 — Epic 6 dependency mis-declared | **Resolved.** Epic 6 dependency statement corrected (Epic 1 + `places`/`place_adn` migration, sequenced after Epic 3) in both the epic list and the full section; same correction applied to the architecture's Decision Impact Analysis. | `epics.md`, `architecture.md` |
| Epic-quality Major #2 — Story 6.1 missing Refine starter init | **Resolved.** Added a starter-init AC block (`npm create refine-app … spawt-admin`) as the first AC of Story 6.1. | `epics.md` |
| Epic-quality Major #3 — Story 3.3 oversized | **Resolved.** Split into Story 3.3a (schema + adapter), 3.3b (`matching.ts` pure engine), 3.3c (`HomeD` + feed UI). | `epics.md` |

**Remaining open items** (governance gates / decisions — owner-assigned, not document defects): triple sign-off on the 8 Claude amendments; the dedicated Contrat §20.1 review of D2/D3; the WCAG AA contrast re-validation + `--alert-red` token (UX-DR2/28); favorites persistence schema (FR-009); the favorites rename (D5); the 8 historized decisions; the `[pending juriste]` CGV items. None block Sprint 1 story execution.
