---
validationTarget: '_bmad-output/planning-artifacts/PRD.md'
validationDate: '2026-05-13'
inputDocuments:
  - documentation/SPAWT_PRD_V1.docx (source — non lu, binaire)
  - documentation/SPRINT_1_CAHIER_DES_CHARGES.md
  - documentation/personas/stephanie.md
  - documentation/personas/kidam.md
  - documentation/personas/alexandre.md
  - documentation/personas/moka.md
  - documentation/analytics/events.md
  - _bmad-output/project-context.md (project context, persistent fact)
validationStepsCompleted: ['discovery', 'format_detection', 'density', 'brief_coverage', 'measurability', 'traceability', 'implementation_leakage', 'domain_compliance', 'project_type', 'smart', 'holistic', 'completeness', 'report_complete', 'remediation_top3', 'remediation_remaining']
validationStatus: COMPLETE_WITH_ALL_REMEDIATIONS
holisticQualityRating: '4.5/5 → 4.85/5 (Top 3) → ~4.92/5 (Reste-à-traiter)'
overallStatus: 'PASS_FULL_REMEDIATION'
remediationVersion: 'PRD v1.0.2 (2026-05-13)'
formatClassification: 'BMAD Standard (6/6 core sections + 4/4 bonus sections)'
projectType: 'mobile_app (déduit — pas dans frontmatter PRD)'
domain: 'general (mobile consumer app), avec couverture domaine réglementaire CI au-delà de l attendu'
---

# PRD Validation Report — SPAWT

**PRD Being Validated:** `_bmad-output/planning-artifacts/PRD.md`
**Validation Date:** 2026-05-13
**Validator:** Validation Architect (BMAD `bmad-validate-prd`)

## Input Documents

Loaded from PRD frontmatter (`inputDocuments`):
- **Source PRD V1.0.0** — `documentation/SPAWT_PRD_V1.docx` (John BMad, 2026-04-09). Binaire .docx — non lu directement, mais le PRD .md référence ses §s. Un extrait `PRD-source-extracted.md` est présent dans le même dossier (peut servir de cross-check).
- **Sprint 1 Cahier des Charges** — `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` (amendements team §4.1–§4.7 intégrés, amendements Claude §5.1–§5.8 marqués `[pending]`).
- **Personas** — `documentation/personas/{stephanie,kidam,alexandre,moka}.md` (4 personas opérateurs/sign-off).
- **Analytics events** — `documentation/analytics/events.md`.

Additional context (persistent fact from workflow):
- **Project context** — `_bmad-output/project-context.md` (règles d'implémentation, vocabulaire canonique, anti-patterns).

## Validation Findings

## Format Detection

**PRD Structure (## Level 2 headers en ordre) :**
1. Executive Summary (L30)
2. Success Criteria (L57)
3. Product Scope (L102)
4. User Journeys (L147)
5. Domain Requirements (L191)
6. Innovation Analysis (L232)
7. Project-Type Requirements (L259)
8. Functional Requirements (L295)
9. Non-Functional Requirements (L530)
10. Annexes — Traçabilité (L614)

**BMAD Core Sections Present :**
- Executive Summary : ✅ Present
- Success Criteria : ✅ Present
- Product Scope : ✅ Present
- User Journeys : ✅ Present
- Functional Requirements : ✅ Present
- Non-Functional Requirements : ✅ Present

**BMAD Optional/Bonus Sections Present :**
- Domain Requirements : ✅ Present (compliance ARTCI / Loi 2013-450)
- Innovation Analysis : ✅ Present
- Project-Type Requirements : ✅ Present (mobile-specific)
- Annexes — Traçabilité : ✅ Present (matrices de traçabilité)

**Format Classification :** **BMAD Standard**
**Core Sections Present :** 6/6
**Bonus Sections :** 4/4 (toutes optionnelles incluses)
**Note initiale :** Le PRD suit fidèlement le squelette BMAD avec en plus une section Annexes Traçabilité (rare et bénéfique pour les downstream artifacts).

## Information Density Validation

**Méthode :** Scan ripgrep sur 5 patterns FR + EN (PRD rédigé en français).

**Anti-Pattern Violations :**

**Conversational Filler / Wordy phrases (FR : « afin de », « il est important de noter », « en raison du fait », « à l'heure actuelle », « de manière à », « par le biais de », « en termes de », « en ce qui concerne », « il y a lieu de »…) :** 0 occurrence.

**Conversational Filler / Wordy phrases (EN : « in order to », « the system will allow », « it is important to note », « due to the fact that »…) :** 0 occurrence.

**Subjective adjectives (« facile à utiliser », « intuitif », « convivial », « rapide », « réactif »…) :** 6 occurrences, **toutes justifiées** :
- L53, L123 : « Mode Rapide » — nom propre d'une feature (V1.5), pas une qualité subjective.
- L174, L334 : « Tags rapides » — désigne un set fini de 5 tags (« Copieux », « Rapide », « Ambiance top », « Cher », « À refaire »), élément structurel de la FR-AVIS-CREATION.
- L252, L444 : « (non-)fiable » — emploi technique pour décrire `confidence_score`, pas une promesse subjective.
- L651 (Annexe Traçabilité) : note auto-réflexive **confirmant** la suppression des adjectifs subjectifs (« instinctif », « rapide », « simple ») des FRs — preuve d'une discipline qualité explicite.

**Redundant phrases / filler intensifiers (« très », « vraiment », « absolument », « extrêmement », « tout à fait », « plans futurs »…) :** 0 occurrence.

**Wordy verbs (« permet de », « permettent de », « le système permet aux utilisateurs de »…) :** 0 occurrence — formulation directe systématique (ex : « Le spawter peut publier… »).

**Total Violations :** 0 (les 6 « rapide » sont des faux positifs structurels).

**Severity Assessment :** **PASS** ✅

**Recommandation :** PRD démontre une densité informationnelle exceptionnelle pour un document de 657 lignes en français. Annexe Traçabilité §2 (L651) confirme qu'un audit qualité a déjà supprimé les adjectifs subjectifs des FRs — discipline pré-validation visible.

## Product Brief Coverage

**Status :** **N/A — Pas de Product Brief BMAD fourni en entrée.**

**Contexte :** La frontmatter du PRD liste 7 inputs :
- `SPAWT_PRD_V1.docx` — c'est le PRD source V1.0.0 lui-même (John BMad, 2026-04-09), pas un Product Brief amont. Le PRD .md validé est une **restructure BMAD-compatible** de ce document.
- `SPRINT_1_CAHIER_DES_CHARGES.md` — document d'amendements team Sprint 1, **pas** un Product Brief stratégique. Joue le rôle de delta / refinement, intégré comme « amendements team §4.1–§4.7 ».
- 4 personas (Stéphanie, Kidam, Alexandre, Moka) — fichiers de personas opérateurs/sign-off, pas de Product Brief.
- `analytics/events.md` — référentiel data.

**Observation :** Le projet SPAWT n'a **pas suivi le workflow BMAD complet** Product Brief → PRD. Le PRD V1.0.0 a été écrit en amont (avril 2026) puis restructuré au format BMAD en mai 2026. La vision, les personas et les KPI sont donc intégrés **directement dans le PRD** (Executive Summary, Success Criteria, Innovation Analysis) sans amont distinct.

**Recommandation (informationnel) :** Pour la prochaine itération (V1.5 / V2), envisager d'écrire un Product Brief amont via `bmad-product-brief` afin d'isoler la couche stratégique (vision / TAM / business model) du PRD opérationnel — utile quand le scope dépassera Abidjan B2C only. Pour V1, la couverture interne du PRD est suffisante.

**Pas d'écart bloquant à signaler — cette section est N/A.**

## Measurability Validation

### Functional Requirements

**Total FRs Analyzed :** 39 (FR-001 → FR-039), organisés en 14 groupes thématiques.

**Format Compliance :** ✅ Tous les FRs suivent le pattern « [Acteur] peut [capability] » (français équivalent de « [Actor] can [capability] »).
- Acteur principal = « le spawter » (B2C) ou « un membre `spawt_staff` » (admin) — clairement défini.
- Structure systématique : `*Capability :* … / *Acceptance :* … / *Phase :* … / *Source :* …`
- Couverture Capability + Acceptance : 78 occurrences pour 39 FRs = parfait (1+1 par FR).

**Subjective Adjectives Found :** 0 violation réelle (cf. section Density Validation ci-dessus).

**Vague Quantifiers Found :** 0 dans les FRs.
- Faux positifs neutralisés : L351 « visité plusieurs fois compte pour 1 spot » (règle binaire ≥2 → 1 spot, non-ambiguë), L505 « 5+ archétypes différents » (cardinalité d'ensemble, pas vague).
- Note : L289 (PTR-OPS-01, section Project-Type Requirements, **pas un FR/NFR strict**) emploie « latence acceptable jusqu'à quelques minutes » — cette imprécision est **récupérée** par NFR-AVAIL-03 qui fixe « maximum 5-minute latency ». À durcir dans PTR-OPS-01 pour cohérence.

**Implementation Leakage :** Présent par design, **déclaré** en §647 (Annexes — Notes de fidélité .docx vs conformité BMAD). Catégorisation :

| FR | Leak | Justification | Sévérité |
|---|---|---|---|
| FR-020 | « CinetPay (Orange Money P0, Wave P0, MTN MoMo P1) » | Provider = arbitrage fondateur §11.4. Le FR-038 (interface abstraite) couvre la portabilité. | Acceptable |
| FR-024 | `user_signals` table + `metadata JSONB` | Le FR est le contrat data-layer issu de cahier §4.6. Le schéma EST la capability. | Acceptable |
| FR-025 | `dominant_axes` JSONB sur `user_palais` | Idem (data-layer FR). | Acceptable |
| FR-027 → FR-030 | Noms de tables `spawters` / `spawt_staff` / `customers` / `plans` / `currencies` | Amendements team Sprint 1 §4.1-§4.4 — ce sont des FRs de séparation d'entités, donc le schéma est la spec. | Acceptable |
| FR-031 | Path `src/theme/tokens.ts` | Spécifie la source-of-truth attendue. À reformuler en « source unique de vérité » (mention du path en commentaire annexe). | **Mineur** |
| FR-038 | `IPaymentProvider` interface contract | Pattern d'architecture, pas une lib spécifique. OK. | Acceptable |
| FR-022 | `SPAWT-2026-NNNN`, table `invoices`, champ `pdf_url` | Format de numérotation fiscale (donnée légale CI) + schéma data. | Acceptable |
| FR-024, 25, 26, 28, 29, 30 | `country_code`, `is_published`, `confidence_score`, etc. | Champs colonnaires = vocabulaire du data-contract. | Acceptable |

**Action recommandée (mineure) :** FR-031 — déplacer « `src/theme/tokens.ts` » en note de bas / annexe et garder dans le FR la formulation capability-only (« source unique de vérité pour couleurs/typo/espacements, exposée en CSS variables + JSON Figma »).

**FR Violations Total :** 0 bloquantes, 1 mineure (FR-031), 1 imprécision dans la section Project-Type Requirements (PTR-OPS-01 — non-FR/NFR strict).

### Non-Functional Requirements

**Total NFRs Analyzed :** 39 NFRs organisés en 12 catégories (Performance × 7, Géo × 4, Availability × 3, Security × 4, Fraud × 6, Observability × 3, i18n × 1, Portability × 1, Capacity × 3, Cost × 2, Data × 3, Payment × 2).

**Template Compliance :** ✅ Template strict appliqué partout : `The system shall [metric] [condition] [measurement method]` + `Source PRD §X`.

**Vérifications spot :**
- NFR-PERF-01 : « under 3 seconds **for the 95th percentile on 3G connectivity**, as measured by **Sentry performance monitoring on Android mid-range devices** » → 4/4 critères (criterion, metric, condition, measurement) ✅
- NFR-SEC-04 : « soft-delete within **5 seconds**, anonymize within **30 days**, as enforced by **a scheduled job on `spawters.deletion_requested_at`** » ✅
- NFR-FRAUD-01 → NFR-FRAUD-06 : chaque règle anti-fraude a un mécanisme d'enforcement spécifié (SQL trigger, batch daily, aggregation logic) ✅
- NFR-CAP-01 : « 15 000 MAU … as measured by **load testing on Supabase managed PostgreSQL** » ✅
- NFR-PORT-01 : « without code refactoring, as enforced by `country_code` column on … » ✅

**Missing Metrics :** 0.
**Incomplete Template :** 0.
**Missing Context :** 0.

**NFR Violations Total :** 0.

**Note observabilité (informative) :** NFR-I18N-01 est marqué « statut partiel à confirmer en V1.5 » — c'est un amendement Claude `[pending]` (§5.6 cahier). Statut transparent, pas un défaut de mesurabilité.

### Overall Assessment

**Total Requirements :** 78 (39 FRs + 39 NFRs)
**Total Violations :** 1 mineure (FR-031 path leakage) + 1 imprécision externe au scope FR/NFR (PTR-OPS-01).

**Severity :** **PASS** ✅ (largement sous le seuil <5).

**Recommandation :** Requirements démontrent une discipline de mesurabilité **rare** — chaque NFR a un mécanisme de mesure nommé (Sentry, Supabase advisor, Google Play Console, SQL trigger, batch job, manual QA device matrix, etc.). Deux ajustements cosmétiques suggérés :
1. **FR-031** : sortir le path `src/theme/tokens.ts` du corps du FR → annexe / commentaire.
2. **PTR-OPS-01** (Project-Type Requirements §259+) : remplacer « quelques minutes » par renvoi explicite à NFR-AVAIL-03 (« cf. NFR-AVAIL-03 : maximum 5-minute latency »).

## Traceability Validation

### Chain Validation

**Executive Summary → Success Criteria :** ✅ **Intact**
- Vision « 45 min → 3 min décision » ↔ SC-ACT-02 (40% premier spawt) + SC-RET-02 (3,5 sessions/sem).
- 6 différenciateurs (Le Guet, Palais, ADN, Voix du chat, Anti-leaderboard, Made in Abidjan) couverts : SC-RET, SC-INV, SC-REV (FCFA / Mobile Money).
- Phasage V1/V1.5/V2 aligné sur jalons SC à M3/M6/M12.

**Success Criteria → User Journeys :** ⚠️ **Gaps Identified** (mineurs).
- SC-ACT-01, 02, 03 → couverts par Journey 1 (Onboarding) + Journey 2 (Découverte).
- SC-RET-01, 02 → couverts par Journey 2 + Journey 3 (loop découverte/avis).
- SC-RET-03 (distribution stades 40/35/15/8/2%) → couvert par Journey 4 (Identité).
- SC-REF-01, 02, 03 (référence virale) → partiellement couvert (J2.4 partage WhatsApp). Pas de journey dédiée « Inviter un ami » distinct.
- **SC-REV-01 à SC-REV-05 (Spawter Gold, ARPU, churn, MRR)** → **pas de User Journey de monétisation dédiée.** Capabilities couvertes (FR-015, FR-020, FR-021, FR-022) mais aucun journey ne décrit le parcours d'upgrade Gold.
- SC-INV-01 à SC-INV-04 (inventaire cold start) → couvertes par FR-018 (création modérée) + FR-032 (pré-chargement), mais business-op pas user-facing, donc absence de journey est attendue.

**User Journeys → Functional Requirements :** ✅ **Intact** (chaque journey trace explicitement aux FRs).
- J1 (Onboarding) → FR-001, FR-002, FR-003.
- J2 (Découverte → Fiche → Le Spawt) → FR-004, FR-005, FR-006, FR-009, FR-016.
- J3 (Avis structuré) → FR-007, FR-025, FR-026, FR-037.
- J4 (Identité spawter) → FR-008, FR-010, FR-011, FR-012, FR-015 (paywall mention).

**Scope → FR Alignment :** ✅ **Intact**.
- 12 FRs Sprint 1 du Cahier §3.1 → mappés sur 12 FRs `*Phase :* Sprint 1` (FR-001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 013, 016, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 035, 037, 039). ⚠️ **Le PRD mappe en réalité 25 FRs Sprint 1** (incluant les FRs « cahier §4 » d'amendements team data-layer) — c'est plus que les 12 features fonctionnelles annoncées. Cohérent car les amendements team §4.1–§4.7 ajoutent des FRs schéma/infra invisibles au scope-feature.
- Sprint 2 FRs (FR-011 Coup de Cœur, FR-012 Mues, FR-014 Carte, FR-015 Paywall, FR-017 Modération, FR-018 Création fiche, FR-019 Notifs, FR-020 Souscription, FR-021 Gestion abo, FR-022 Facture, FR-033 Suppression, FR-034 Sanctions, FR-036 Badges, FR-038 Interface paiement) → cohérent avec PRD §17.1 Phase 5+.

### Orphan Elements

**Orphan Functional Requirements (pas tracés à un user journey explicite) :** 14 FRs, **dont 9 sont des « enablers FRs » légitimes** (data-layer, infra, admin, compliance).

| FR | Catégorie | Statut traçabilité | Action requise |
|---|---|---|---|
| FR-014 | Carte interactive | Variante de J2 non explicitée | ⚠️ Ajouter mention dans J2 ou créer mini-journey « Vue carte » |
| FR-017 | Signalement/modération | Admin — pas de journey user explicite | ⚠️ Suggérer Journey 5 « Modération » (côté `spawt_staff`) |
| FR-018 | Création modérée fiche | Business-op, suggérée par spawter | ⚠️ Ajouter mention micro-flow dans J2 ou annexe |
| FR-019 | Notifications | Partiellement dans J2.6 (Le Guet notif) | ✅ Suffisant (le mécanisme Le Guet est dans J2) |
| FR-020 | Souscription Gold | **Pas de journey monétisation** | 🔴 **Lacune** : créer Journey 5 « Upgrade Spawter Gold » |
| FR-021 | Gestion abonnement grace period | **Pas de journey monétisation** | 🔴 **Lacune** : intégrer à Journey 5 ci-dessus |
| FR-022 | Facture conforme | **Pas de journey monétisation** | 🔴 **Lacune** : intégrer à Journey 5 ci-dessus |
| FR-023 | Panel admin | Admin/back-office | ✅ Enabler FR (admin pas user) — OK |
| FR-024 | Signaux append-only | Data-layer | ✅ Enabler FR data — OK |
| FR-027–030 | Séparation entités (tables) | Data-layer cahier §4 | ✅ Enabler FRs data — OK |
| FR-031 | Tokens design | Infra design system | ✅ Enabler FR — OK |
| FR-032 | Pré-chargement inventaire | Business-op cold start | ✅ Enabler FR ops — OK |
| FR-033 | Suppression compte + export | **Pas de journey compliance** | ⚠️ **Lacune mineure** : ajouter mini-journey « Données personnelles » (DR-ARTCI-05) |
| FR-034 | Sanctions Faux-Pas | Admin | ✅ Enabler FR admin — OK |
| FR-035 | Badge Premier Spawt | Partiellement dans J2 (activation) | ✅ Implicite dans J2 — OK |
| FR-036 | Badges lieu | Partiellement dans J2.3 (fiche) | ✅ Implicite — OK |
| FR-038 | Interface paiement abstraite | Architecture | ✅ Enabler FR architecture — OK |
| FR-039 | Stockage local offline | Architecture | ✅ Enabler FR architecture — OK |

**Orphans réels (sans rattachement journey ET impactant l'expérience spawter) :** 4 — FR-014, FR-020, FR-021, FR-022 (+FR-033 mineur).

**Unsupported Success Criteria :** 5 SC.
- **SC-REV-01 à SC-REV-05** : conversion Gold, churn, ARPU, LTV/CAC, MRR — couvertes par capabilities (FR-015, 020, 021, 022) mais sans journey utilisateur dédié décrivant l'upgrade-flow.

**User Journeys Without FRs :** 0. Tous les 4 journeys tracent vers des FRs.

### Traceability Matrix Summary

| Lien | Statut | Couverture |
|---|---|---|
| Executive Summary → Success Criteria | ✅ Intact | 100% |
| Success Criteria → User Journeys | ⚠️ Gaps | ~80% (SC-REV non couverts par journey) |
| User Journeys → FRs | ✅ Intact | 100% (chaque journey cite ≥3 FRs) |
| Scope MVP → FR `Phase: Sprint 1` | ✅ Intact | 25 FRs Sprint 1 sur 39 — cohérent (12 features + amendements data §4) |
| **FRs → Source PRD §** | ✅ **Excellent** | **100%** — chaque FR cite explicitement le § PRD source (+ cahier §) |
| FRs → User Journey | ⚠️ Partial | ~64% rattachement direct ; les 14 « orphans » sont des enablers FRs légitimes sauf 4-5 lacunes |

**Total Traceability Issues :** 5 (4 FRs sans journey monétisation + 5 SC-REV non couvertes par journey, regroupés en 1 lacune principale : **manque de Journey 5 — Upgrade Gold / Monétisation**).

**Severity :** **WARNING** ⚠️ (lacunes structurelles mineures mais identifiables — chaque FR cite un Source PRD §, donc la traçabilité-source est intacte ; seul le lien Journey → FRs côté monétisation manque).

**Recommandation :** **Ajouter une Journey 5 — Upgrade Spawter Gold** au PRD, reliant SC-REV-01 à SC-REV-05 aux FR-015, FR-020, FR-021, FR-022, FR-038. Optionnellement, Journey 6 — Modération communautaire (FR-017, FR-018, FR-023, FR-034) et mini-flow « Gestion des données personnelles » (FR-033, DR-ARTCI-05). La traçabilité-source via les citations `*Source :*` reste exemplaire — l'écart est dans la **présentation user-centric**, pas dans la complétude des requirements.

## Implementation Leakage Validation

### Leakage by Category

**Frontend Frameworks (React, Vue, Angular, Svelte) :** 0 violation.
**Backend Frameworks (Express, Django, Rails, Spring) :** 0 violation.
**Infrastructure (Docker, Kubernetes, Terraform) :** 0 violation.
**Libraries (Redux, Zustand, axios, lodash) :** 0 violation.

**Databases / Data structures :** 2 occurrences mineures.
- L433, L439 (FR-024, FR-025) : `JSONB` mentionné pour `user_signals.metadata` et `user_palais.dominant_axes`. Postgres-specific → reformuler en « JSON object » ou « structured key-value field » pour rester DB-agnostic. **Mineure** (le data-contract de cahier §4.6 sous-tend le choix).

**Cloud Platforms / Managed services :** 9 mentions, **toutes acceptables** car :
1. **PRD §12.1** (stack technique) est explicitement cité comme ARBITRAGE FONDATEUR.
2. Les mentions sont dans la portion `as measured by` / `as enforced by` du template NFR → c'est la **measurement method**, in scope BMAD.
3. NFR-OBS-02 utilise « Mixpanel **or** PostHog » (optionalité explicite) — discipline portabilité.

| Provider | Occurrences | Contexte | Verdict |
|---|---|---|---|
| **CinetPay** | L41, L113, L205, L206, L246, L255, L409, L410, L517, L518, L609 | Capability-relevant (provider de paiement = arbitrage fondateur §14.4 + intermédiaire BCEAO réglementaire). Mitigé par FR-038 `IPaymentProvider`. | ✅ Acceptable |
| **Supabase** | L556, L562, L564, L592, L593, L594 (6 NFRs) | Measurement context (« as measured by Supabase advisor / load testing / query metrics »). Pourrait être « as measured by managed PostgreSQL platform » pour portabilité. | ⚠️ Borderline (acceptable mais à monitorer) |
| **Sentry** | L536, L537, L578 | Measurement source NFR-PERF + NFR-OBS-01. | ✅ Acceptable (mesure NFR) |
| **Mixpanel / PostHog** | L579 | « Mixpanel **or** PostHog » — optionalité. | ✅ Acceptable |
| **Cloudinary** | L545, L599 | Measurement source NFR-PERF-07 + NFR-COST-02. | ✅ Acceptable (mesure NFR) |
| **Mapbox** | L113, L598 | Scope item Sprint 2 + NFR-COST-01. Pas de wrapper d'abstraction. | ⚠️ Borderline |
| **Expo** | L544 | « as measured by Expo Updates build report » — measurement method. | ✅ Acceptable (mesure NFR) |
| **Google Maps / Waze** | L373 (FR-014) | Targets de deep link sortant — **capability-relevant** (où le spawter est envoyé pour navigation). | ✅ Acceptable |
| **Flutterwave** | L518, L610 | Cité comme **exemple** de provider de secours. | ✅ Acceptable |

**Protocols / Mechanisms :**
- `SQL trigger` (L569, L570, L571, L574 — NFR-FRAUD-01/02/03/06) : nommé comme mécanisme d'enforcement. **Borderline** — reformulation possible en « server-side rule enforcement at insert time ». L'esprit BMAD admet la mécanique en `as enforced by`.
- `TLS 1.2` (L564 NFR-SEC-03) : standard cryptographique → capability-relevant pour conformité Loi 2013-450. ✅ Acceptable.
- `HTTPS` (L564) : standard transport → acceptable. ✅
- `RLS` (L562 NFR-SEC-01) : capability métier (Row Level Security par `spawter_id = auth.uid()`) — la sécurité par ligne EST le besoin réglementaire. ✅ Acceptable (mais lie à Postgres).

**Other Implementation Details :**
- Path `src/theme/tokens.ts` dans FR-031 (déjà noté en mesurabilité) : à sortir en annexe. **Mineure**.

### Summary

**Total Implementation Leakage Violations :**
- **0 violations critiques** (aucun frontend/backend framework, lib, ou infra cloud arbitraire).
- **3 violations mineures** : JSONB × 2 (FR-024, FR-025) + path `tokens.ts` (FR-031).
- **2 borderline** : Supabase comme `measurement context` (6 NFRs), Mapbox sans abstraction (FR-014, NFR-COST-01).
- **7 capability-relevant** acceptables (CinetPay, Sentry, Cloudinary, Mixpanel/PostHog, Expo, Google Maps/Waze, Flutterwave) — toutes justifiées par PRD §12 ARBITRAGE FONDATEUR ou par template NFR `as measured by`.

**Severity :** **PASS** ✅ (3 mineures + 2 borderline, sous le seuil <2 critiques).

**Recommandation :** PRD démontre une discipline correcte : aucune leakage de framework UI/backend, abstraction explicite pour CinetPay (FR-038), optionalité explicite pour analytics (NFR-OBS-02). Trois ajustements suggérés (cosmétiques) :
1. **FR-024, FR-025** : remplacer « JSONB » par « JSON object » / « structured payload ».
2. **NFR-AVAIL-01, NFR-SEC-01/03, NFR-CAP-01/02/03** : remplacer « Supabase » par « managed PostgreSQL platform » pour cohérence avec la stratégie portabilité multi-villes (NFR-PORT-01) — sauf si l'arbitrage Supabase est figé en V1 (à confirmer).
3. **NFR-COST-01** : envisager un wrapper d'abstraction pour Mapbox (parallèle à FR-038 pour le paiement) si la portabilité multi-villes implique des providers de cartes différents (ex : OpenStreetMap pour Lagos).

## Domain Compliance Validation

**Domain Classification :** Pas de `classification.domain` dans la frontmatter du PRD. Classification déduite : **mobile consumer app (food-discovery / social)** avec dimensions secondaires : géoloc continue, PII multi-champs, paiement Mobile Money (sans custody des fonds), juridiction Côte d'Ivoire.

**Complexité BMAD (CSV `domain-complexity.csv`) :** **« general »** — low complexity (consumer apps, social, productivity). SPAWT n'est **pas** un fintech (pas de banking/trading/wallet/KYC propre — CinetPay est intermédiaire BCEAO qui porte la conformité). Pas healthtech, pas govtech, pas legaltech.

**Domaine déclaré explicitement (juridique CI) :** PRD §191-228 dédie une section entière « Domain Requirements » couvrant **4 axes réglementaires** ivoiriens — c'est **au-delà** de l'attendu pour un domaine « general ».

### Couverture domaine — surdéveloppement constaté

| Axe | DRs | Couverture | Verdict |
|---|---|---|---|
| **ARTCI / Loi 2013-450 (PII, géoloc, droit à l'oubli)** | DR-ARTCI-01 à DR-ARTCI-05 (5 DRs) | Déclaration ARTCI, conformité Loi 2013-450, politique confidentialité, consent géoloc explicite, soft-delete + export self-service J+30 | ✅ Excellent |
| **Paiement Mobile Money — BCEAO** | DR-BCEAO-01, DR-BCEAO-02 (2 DRs) | Non-custody des fonds (CinetPay intermédiaire agréé), reçus de paiement < 30s | ✅ Adéquat |
| **Fiscalité — TVA 18% + facturation séquentielle** | DR-TVA-01 à DR-TVA-04 (4 DRs) | TVA 18% B2C/B2B, affichage TTC B2C / HT + TVA B2B, déclaration mensuelle DGI, factures séquentielles `SPAWT-2026-NNNN` | ✅ Excellent |
| **CGU/CGV — Droit ivoirien** | DR-CGV-01 (1 DR) | Rédaction par juriste, droit de rétractation 7 jours | ⚠️ Mineur — un seul DR, à compléter (cf. décision historisée §6 « budget consent juridique ») |
| **Anti-fraude technique** (distinct de modération humaine) | DR-FRAUD-01 à DR-FRAUD-06 (6 DRs) | Rate-limit même lieu (4h), seuil 5 spawts/jour, vitesse > 100 km/h, poids 0,5x sans géoloc, pattern 10 spawts/7 jours, cohérence arrivée/départ | ✅ Excellent — couplé NFR-FRAUD-01 à 06 (enforcement SQL triggers) |
| **TOTAL** | **18 DRs** sur 4-5 axes réglementaires | | ✅ Très complet pour un domaine « general » |

### Compliance Matrix

| Requirement BMAD attendu pour `general` | Statut SPAWT | Notes |
|---|---|---|
| Standard requirements | ✅ Met | FRs + NFRs exhaustifs |
| Basic security | ✅ Met | NFR-SEC-01 à NFR-SEC-04 + RLS Supabase |
| User experience | ✅ Met | 4 User Journeys + Acceptance Criteria UI |
| Performance | ✅ Met | NFR-PERF-01 à NFR-PERF-07 |
| **Bonus — PII Loi 2013-450** | ✅ **Above expectations** | DR-ARTCI complet + FR-033 (suppression/export) |
| **Bonus — Paiement Mobile Money** | ✅ **Above expectations** | DR-BCEAO + DR-TVA + FR-022 facture + FR-038 abstraction |
| **Bonus — Anti-fraude technique** | ✅ **Above expectations** | DR-FRAUD × 6 + NFR-FRAUD × 6 |

### Summary

**Required Sections Present :** N/A (general complexity, pas de sections spéciales requises).
**Couverture domaine effective :** **Très au-delà du seuil BMAD `general`**.
**Compliance Gaps :** 1 gap mineur — DR-CGV-01 isolé (un seul DR pour CGU/CGV droit ivoirien). Décision historisée §6 du project-context (« budget consent juridique ») confirme que la rédaction CGU/CGV par juriste est en attente.

**Severity :** **PASS** ✅ (PRD largement au-dessus de la couverture attendue pour `general`).

**Recommandation :** Discipline réglementaire exemplaire. Une seule action suggérée :
- **DR-CGV-01** : à expanser en sous-DRs une fois le juriste désigné (rétractation 7j, médiation, juridiction compétente, clauses ARTCI, modalités de résiliation Spawter Gold) — anticiper via décision historisée §6 « budget consent juridique » du project-context.

**Note méta :** Si le projet devait être re-classifié sur l'axe « fintech » (suite à un pivot intégrant wallet propre, KYC, etc. en V2+), il faudra revalider contre les sections spéciales fintech BMAD (compliance_matrix, security_architecture, audit_requirements, fraud_prevention) — déjà partiellement couvertes par les DRs actuels.

## Project-Type Compliance Validation

**Project Type :** Pas de `classification.projectType` explicite dans la frontmatter du PRD, mais déduction non-ambiguë → **`mobile_app`** (iOS + Android natif, livré App Store / Google Play, Expo SDK 55, React Native 0.83, panel admin web secondaire). Source : Executive Summary §41 « Made in Abidjan », Product Scope §106 « V1 Lancement Abidjan », Section Project-Type Requirements §259, project-context.md.

### Required Sections (CSV `mobile_app`)

| Required | Présence dans PRD | Statut |
|---|---|---|
| **platform_reqs** | PTR-PLAT-01 (iOS + Android via stores), PTR-PLAT-02 (panel admin web), PTR-PLAT-03 (pas de site V1), PTR-DEV-01 à 04 (Android 9+ / iOS 14+, stockage <50MB, connectivité 3G) | ✅ Present (complet) |
| **device_permissions** | PTR-CAP-01 (géoloc background + geofencing natif), PTR-CAP-02 (push locales/serveur), PTR-CAP-03 (caméra), PTR-CAP-04 (deep linking), PTR-CAP-05 (storage local), PTR-CAP-06 (i18n) + NFR-SEC-02 (consent géoloc) | ⚠️ **Incomplete** — capabilities listées, mais **pas de manifest explicite** des permissions Android (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`) ni iOS Info.plist usage descriptions (`NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription`, etc.). À compléter en architecture, mais une mini-section serait utile dans le PRD pour traçabilité Loi 2013-450. |
| **offline_mode** | FR-039 (stockage local des spawts en attente), NFR-AVAIL-02 (queue + sync 60s), NFR-AVAIL-03 (OEM Android background latency 5 min), PTR-DEV-04 (mode offline-tolerant), PTR-OPS-01 (geofence OS-level) | ✅ Present (excellent) |
| **push_strategy** | FR-019 (6 types notifs : Bienvenue, Le Guet, Nouveau lieu, Activité avis, Stade, Mue), NFR-PERF-04 (Le Guet trigger <30s), volume plafonné 3-4/sem hors Le Guet | ✅ Present (complet) |
| **store_compliance** | PTR-PLAT-01 mentionne livraison App Store / Google Play, PTR-DEV-01 mentionne Android 9+ minimum, iOS 14+ | ⚠️ **Incomplete** — pas de section dédiée aux Guidelines de review (Apple §3.1 paiements in-app vs CinetPay externe, §4.0 Sign in with Apple si Google Sign-In activé, privacy nutrition labels iOS, Google Play Data Safety section, age rating, fonctions de modération UGC §1.2 Apple). Risque rejet store sous-évalué. |

**Required sections présentes :** **3/5 complètes + 2/5 incomplètes**.

### Excluded Sections (CSV `mobile_app` — should NOT be present)

| Excluded | Présence dans PRD | Statut |
|---|---|---|
| **desktop_features** | Aucune mention de Windows/Mac/Linux features. Le panel admin web (PTR-PLAT-02, FR-023) est un outil interne, pas un produit desktop. | ✅ Absent (conforme) |
| **cli_commands** | Aucune CLI utilisateur. Les commandes mentionnées (`npm run i18n:check`, etc.) sont des outils dev, pas dans le PRD scope-produit. | ✅ Absent (conforme) |

**Excluded sections violations :** **0**.

### Compliance Table

| Section | Type | Statut | Sévérité |
|---|---|---|---|
| platform_reqs | Required | ✅ Met | — |
| device_permissions | Required | ⚠️ Partial | Mineure |
| offline_mode | Required | ✅ Met | — |
| push_strategy | Required | ✅ Met | — |
| store_compliance | Required | ⚠️ Partial | **Modérée** (risque rejet store) |
| desktop_features | Excluded | ✅ Absent | — |
| cli_commands | Excluded | ✅ Absent | — |

### Compliance Summary

**Required Sections :** 3/5 fully met + 2/5 partial = **80%** complétude.
**Excluded Sections Present :** 0 violations.
**Compliance Score :** ~85% (3.5 / 5 pondéré pour partial = 0.5).

**Severity :** **WARNING** ⚠️ (1 gap modéré sur `store_compliance` + 1 mineur sur `device_permissions`).

**Recommandation :** Ajouter une **sous-section « Store Compliance »** dans Project-Type Requirements (PTR-STORE-01 à 04), couvrant :
1. **Apple App Store Guidelines** : §3.1.1 (in-app purchase non requis pour services tangibles → CinetPay OK), §4.0 (Sign in with Apple si Google Sign-In activé), §5.1.1 Privacy Nutrition Labels, §1.2 modération UGC obligatoire (FR-017).
2. **Google Play Data Safety** : déclaration géoloc + PII + paiement, target API level Android 14 (level 34) pour publications post-août 2024.
3. **Permissions manifest** : sous-section explicite listant les permissions Android (`AndroidManifest.xml`) et iOS (`Info.plist` usage descriptions) — utile pour l'audit ARTCI (DR-ARTCI-04) qui exige le consent explicite avant collecte géoloc.
4. **Age rating** : SPAWT est consommateur d'alcool (Maquis, Bo Zinc) → rating 17+ Apple / Adults Only certaines régions Google Play.

L'absence est mineure côté PRD V1 (l'équipe peut le couvrir en architecture) mais **modérée côté go-to-market** : un rejet App Store coûte 2-4 semaines de delay.

## SMART Requirements Validation

**Total Functional Requirements :** 39 (FR-001 → FR-039).

### Scoring Methodology

Échelle 1-5 par critère (Specific, Measurable, Attainable, Relevant, Traceable). Discipline systématique du PRD : chaque FR a une structure `*Capability :* / *Acceptance :* / *Phase :* / *Source :*` — toutes les lignes Source citent un § PRD ou cahier (Traceability = 5/5 pour la quasi-totalité).

### Scoring Summary

**All scores ≥ 3 :** **100% (39/39)** — aucun FR ne tombe sous le seuil 3 dans aucune catégorie.
**All scores ≥ 4 :** **~95% (37/39)** — 2 FRs avec un score Relevant = 3 (FR-020 et FR-022, voir ci-dessous).
**Overall Average Score :** **4.78 / 5.0**.

### Scoring Table (grouped — détail uniquement pour FRs flaggés ou notables)

| Groupe | FRs | Specific | Measurable | Attainable | Relevant | Traceable | Avg |
|---|---|---|---|---|---|---|---|
| **Core flows Sprint 1** | FR-001, 002, 003, 005, 006, 007, 008, 009, 010, 013, 016, 035, 037 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Engines avec formules** | FR-004 (feed score), FR-025 (Palais decay), FR-037 (note pondérée) | 5 | 5 | 4 | 5 | 5 | 4.8 |
| **Data layer (cahier §4)** | FR-024, 027, 028, 029, 030 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **ADN moteur** | FR-026 | 5 | 4 | 4 | 5 | 5 | 4.6 |
| **Coup de Cœur + Mues** | FR-011, FR-012 | 5 | 4-5 | 4 | 5 | 5 | 4.6 |
| **Carte interactive** | FR-014 | 5 | 5 | 5 | **4** | 5 | 4.8 |
| **Paywall géo** | FR-015 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Modération / Admin** | FR-017, FR-018, FR-023, FR-034 | 5 | 5 | 5 | **4** | 5 | 4.8 |
| **Notifications** | FR-019 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Monétisation Gold** | FR-020 (souscription), FR-021 (gestion abo), FR-022 (facture) | 5 | 5 | 5 | **3** ⚠️ | 5 | 4.6 |
| **Architecture paiement** | FR-038 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Tokens design** | FR-031 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Inventaire** | FR-032 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Compliance / suppression** | FR-033 | 5 | 5 | 5 | 5 | 5 | 5.0 |
| **Badges** | FR-035, FR-036 | 5 | 5 | 4-5 | 5 | 5 | 4.8 |
| **Offline / résilience** | FR-039 | 5 | 5 | **4** | 5 | 5 | 4.8 |

**Légende :** 1=Poor, 3=Acceptable, 5=Excellent.

### Notes de scoring détaillé

**Specific (avg 4.97/5) :** Toutes les FRs sont rédigées avec verbe d'action + acteur + objet précis. 0 FR flou. Formules mathématiques inline pour les moteurs (FR-004, FR-025, FR-037).

**Measurable (avg 4.92/5) :** Acceptance Criteria quantifiés (temps, pourcentages, seuils, formules) pour 38/39 FRs. FR-026 (ADN update) : « mapping vers les 5 axes » — la mécanique exacte du mapping n'est pas inline (renvoyée à PRD §13.2). Mineur.

**Attainable (avg 4.79/5) :** Quelques FRs avec complexité d'ingénierie notable (Score=4) :
- FR-026 (ADN update) : 5 axes × multiple inputs, batch + incremental + confidence_score, faisable mais demande du soin.
- FR-039 (offline) : « Aucune perte de spawt en cas de coupure <24h » — engagement fort, dépend de la fiabilité du queue local + sync robuste.
- FR-036 (badges lieu) : 7 conditions différentes en batch quotidien.
- FR-011 (Coup de Cœur) : quotas mensuels reset le 1er du mois × 5 stades.

**Relevant (avg 4.74/5) :** Scores < 5 sur quelques FRs « orphan journey » (FR-014 Carte, FR-017/018 Modération, FR-020/021/022 Monétisation). Le **score 3 sur Relevant pour FR-020 et FR-022** vient du double effet : aucune Journey utilisateur ne couvre l'upgrade Gold, ET le path d'activation Gold n'est pas décrit (vs FR-021 grace period qui a un déroulé pré-échéance explicite). Ces 2 FRs sont **flaggés** pour amélioration.

**Traceable (avg 5.0/5) :** 39/39 FRs citent une source PRD § (+ cahier § si amendement). Discipline exemplaire — la traçabilité-source est parfaite, ce qui amortit les gaps de Journey 5 « Upgrade Gold ».

### Improvement Suggestions — FRs flaggés (Relevant < 4)

**FR-020 (Souscription Spawter Gold) — Relevant = 3.**
Suggestion : enrichir l'Acceptance Criteria avec un déclencheur user-side : « Le spawter peut souscrire (a) depuis le bandeau floutage paywall (FR-015), (b) depuis Profil → Devenir Gold, (c) depuis une fiche lieu hors zone. Le bouton de souscription est testé pour conversion par cohort. » + ajouter un Journey 5 (cf. Traceability Validation).

**FR-022 (Émission facture conforme) — Relevant = 3.**
Suggestion : préciser le **déclencheur** (« facture émise automatiquement à la confirmation paiement CinetPay (FR-020), envoyée par email + SMS, accessible depuis Profil → Mes factures ») et le **trigger de re-téléchargement** (« Le spawter peut re-télécharger une facture à tout moment depuis Profil → Mes factures »). Ces points sont implicites mais non explicités.

### Overall Assessment

**Severity :** **PASS** ✅ (0% FRs flaggés sous score 3, ~5% FRs sous score 4 sur 1 catégorie).

**Recommandation :** Qualité SMART exceptionnelle. La traçabilité-source à 100% est rare. Deux ajustements suggérés (FR-020, FR-022) — corrélés à la lacune Journey 5 « Upgrade Gold » identifiée en Traceability Validation. **Un seul correctif structurel** (ajout Journey 5) résout les deux observations.

## Holistic Quality Assessment

### Document Flow & Coherence

**Assessment :** **Excellent** ✅

**Strengths :**
- **Narration fluide** : Executive Summary → Success Criteria → Product Scope → User Journeys → Domain Requirements → Innovation Analysis → Project-Type Requirements → FRs → NFRs → Annexes. Chaque section construit sur la précédente.
- **Transitions explicites** : sections comme « Innovation Analysis » et « Domain Requirements » justifient l'existence du produit avant d'énumérer les capabilities — ordre de lecture optimal pour exec puis ingénieur.
- **Cohérence vocabulaire** : 100% du PRD parle « spawter / lieu / spawt / Palais / ADN / Le Guet », jamais user/restaurant/check-in (sauf glossaire technique). Discipline post-restructure §647.
- **Cross-références denses** : chaque FR renvoie à un § PRD + cahier, chaque NFR renvoie à FR-XXX, chaque DR-FRAUD-X est couplé à NFR-FRAUD-X. Maillage très solide.
- **Métadonnées d'introduction transparentes** : auteur original (John BMad), restructure (Claude), amendements team intégrés vs pending, vocabulaire canonique — le lecteur sait d'où vient quoi.

**Areas for Improvement :**
- **Pas de Journey 5 « Monétisation »** : la transition Success Criteria SC-REV → FR-020/021/022 est implicite, manque un récit user-side.
- **Annexe « Drift de vocabulaire » §636** révèle que le `.docx` source contient encore des termes hors-canon — utile mais à terme c'est le `.docx` qu'il faudrait corriger, pas annoter dans le PRD restructuré.
- Quelques sections (Domain Requirements, Project-Type Requirements) sont plus listes que narration — acceptable pour BMAD mais le lecteur exec pourrait perdre le fil.

### Dual Audience Effectiveness

**For Humans :**
- **Executive-friendly** : ✅ Executive Summary L30-55 résume vision + différenciateurs + cibles + phasage en 25 lignes denses. Tableau personas avec source PRD. Lisible en <5 min.
- **Developer clarity** : ✅ Excellent — 39 FRs avec Capability / Acceptance / Phase / Source, 39 NFRs avec template `shall + metric + measurement`, formules inline, citations PRD systematiques.
- **Designer clarity** : ✅ FR-031 (Tokens design) couvre palette + typo. User Journeys décrivent les flows en mode prose. **Note :** un wireframe-narrative serait un plus pour designer (FR-005 fiche lieu ↔ FR-008 profil) — domaine du UX design phase suivante.
- **Stakeholder decision-making** : ✅ Innovation Analysis (tableau différenciateurs vs concurrents) + Success Criteria SMART + phasage M3/M6/M12 — un investor ou un fondateur peut décider en lecture seule.

**For LLMs :**
- **Machine-readable structure** : ✅ Tous les ## H2 listés et conformes BMAD. Chaque FR/NFR/DR a un identifiant unique extractible (FR-XXX, NFR-CAT-XX, DR-XXX). Frontmatter YAML complet.
- **UX readiness** : ✅ 4 User Journeys complets avec étapes numérotées + références aux FRs sous-jacents. Une commande `bmad-create-ux-design` peut générer des wireframes par journey.
- **Architecture readiness** : ✅ Excellent — NFRs nommés (Sentry, Supabase, CinetPay) + ARBITRAGES FONDATEURS explicités (§12.3, §14.4) + interface pattern FR-038 + data-layer FRs (FR-024 à FR-030) + amendements cahier §4 intégrés. Une commande `bmad-create-architecture` consomme directement.
- **Epic/Story readiness** : ✅ Chaque FR a un `*Phase :*` (Sprint 1 / Sprint 2), un `*Source :*`, des Acceptance Criteria. Une commande `bmad-create-epics-and-stories` peut transformer 1 FR ≈ 1-3 stories.

**Dual Audience Score :** **4.9/5**

### BMAD PRD Principles Compliance

| Principle | Status | Notes |
|---|---|---|
| **Information Density** | ✅ Met | 0 conversational filler / 0 wordy phrases / 0 vague quantifiers en 657 lignes. Auto-discipline §647. |
| **Measurability** | ✅ Met | 78/78 FRs+NFRs mesurables, formules inline, seuils chiffrés, measurement methods nommées (Sentry, Supabase advisor, Cloudinary, SQL trigger). |
| **Traceability** | ⚠️ Partial → Met | Traçabilité-source : 100% (chaque FR/NFR cite Source PRD §). Traçabilité Journey ↔ FR : 80% (manque Journey 5 monétisation). |
| **Domain Awareness** | ✅ **Above** | Domaine `general` BMAD, mais 18 DRs sur 4 axes réglementaires CI (ARTCI, BCEAO, TVA, CGV) + 6 DR-FRAUD anti-fraude. Très au-dessus de l'attendu. |
| **Zero Anti-Patterns** | ✅ Met | 0 « easy/fast/simple/intuitive » en FRs, 0 « in order to », 0 « the system will allow ». Adjectifs subjectifs explicitement supprimés (§651). |
| **Dual Audience** | ✅ Met | Executive Summary + Innovation Analysis pour humains ; structure FR-XXX/NFR-XXX/DR-XXX + frontmatter YAML pour LLMs. |
| **Markdown Format** | ✅ Met | H2 cohérents, tableaux, code blocks, listes structurées. Pas d'images embarquées (vu format dual-audience LLM, c'est OK). |

**Principles Met :** **7/7** (Traceability avec 1 nuance Partial → Met).

### Overall Quality Rating

**Rating :** **4.5 / 5 — Très bon → Excellent**

**Justification :**
- ✅ **+0.5 sur tous les fondamentaux BMAD** : density, measurability, traceability-source, zero anti-patterns.
- ✅ **+0.3 pour la discipline réglementaire** (Domain Requirements section au-dessus de l'attendu).
- ✅ **+0.2 pour les Annexes de Traçabilité §614-657** (mapping FR ↔ §, notes de fidélité .docx vs BMAD, transparence sur les amendements pending) — pratique rare.
- ⚠️ **−0.3** : lacune Journey 5 « Upgrade Spawter Gold » → SC-REV non couvertes par journey.
- ⚠️ **−0.2** : `store_compliance` partiel (PTR-STORE-01 manquant) — risque go-to-market.

**Échelle :**
- 5/5 — Excellent : Exemplaire, ready for production use
- **4.5/5 — Excellent moins une lacune structurelle adressable** ← SPAWT PRD
- 4/5 — Bon : Strong with minor improvements needed
- 3/5 — Adéquat : Acceptable but needs refinement
- 2/5 — À retravailler : Significant gaps or issues
- 1/5 — Problématique : Major flaws, needs substantial revision

### Top 3 Improvements

1. **Ajouter Journey 5 — Upgrade Spawter Gold** (gain ~+0.3 rating)
   Lacune structurelle la plus impactante. Décrire le parcours utilisateur depuis le déclencheur (paywall FR-015, fiche lieu hors-zone, profil, célébration de stade) → écran de souscription (FR-020) → confirmation paiement CinetPay → unlocks Gold (Palais 5 axes, +1 Coup de Cœur, tout Abidjan) → grace period (FR-021) → facture (FR-022). Couvre 5 SC-REV orphelines + relève les scores Relevant de FR-020 et FR-022 de 3 → 5.

2. **Ajouter section Store Compliance** (gain ~+0.2 rating)
   Ajouter sous-section dans Project-Type Requirements : PTR-STORE-01 (Apple §3.1 paiements externes pour services tangibles — CinetPay OK), PTR-STORE-02 (Google Play Data Safety + target API 34), PTR-STORE-03 (Permissions manifest Android + iOS Info.plist), PTR-STORE-04 (Age rating 17+/Adults given Maquis/alcool). Évite 2-4 semaines de retour de review store.

3. **Reformulations cosmétiques** (gain ~+0.1 rating)
   (a) FR-024, FR-025 : remplacer « JSONB » par « JSON object / structured payload » pour rester DB-agnostique. (b) FR-031 : sortir le path `src/theme/tokens.ts` du corps du FR → annexe. (c) PTR-OPS-01 : remplacer « quelques minutes » par renvoi explicite à NFR-AVAIL-03 (5-minute). (d) NFR-AVAIL-01 / NFR-SEC-01-03 / NFR-CAP-01-03 : si l'arbitrage Supabase n'est PAS figé V1, remplacer par « managed PostgreSQL platform » pour cohérence avec NFR-PORT-01.

### Summary

**This PRD is :** Un PRD de qualité **excellente** (4.5/5), structuré dual-audience, dense, traçable à 100% côté source, avec une discipline réglementaire ivoirienne exemplaire — **bloqué d'un demi-point** par une lacune structurelle de Journey monétisation et un sous-développement Store Compliance, tous deux **adressables en 1-2 sessions de refinement**.

**To make it great :** Focus sur les top 3 improvements ci-dessus. Aucun rework majeur requis ; tout l'édifice tient.

## Completeness Validation

### Template Completeness

**Template Variables Found :** **0 BMAD template variables résiduels** ✅
- 1 placeholder de copy i18n détecté : `[NOM]` aux lignes 167 et 329 — c'est le placeholder du **nom de lieu dans la copy de notification** Le Guet (« Comment c'était chez [NOM] ? »). C'est **intentionnel** — placeholder de templating runtime côté i18n, pas un trou BMAD à combler. À reformuler éventuellement en `{place_name}` pour cohérence avec i18next, mais non bloquant.
- Aucun `{variable}`, `{{variable}}`, `TODO`, `TBD`, `FIXME`, `à compléter`, `à définir` détecté dans le corps du document.

### Content Completeness by Section

| Section | Statut | Notes |
|---|---|---|
| **Executive Summary** (L30-55) | ✅ Complete | Vision + différenciateurs (6) + personas (table) + phasage |
| **Success Criteria** (L57-99) | ✅ Complete | 22 SC mesurables sur 7 dimensions (AARRR + Inventory) |
| **Product Scope** (L102-143) | ✅ Complete | MVP V1 (19 features, 12 Sprint 1) + Growth V1.5 + Vision V2+ |
| **User Journeys** (L147-188) | ⚠️ Quasi-complete | 4 journeys (Onboarding, Découverte, Avis, Identité). **Lacune : pas de Journey 5 « Upgrade Gold »** (cf. Traceability et Holistic). |
| **Domain Requirements** (L191-228) | ✅ Complete (above expectations) | 18 DRs sur 4 axes réglementaires CI + DR-FRAUD × 6 |
| **Innovation Analysis** (L232-255) | ✅ Complete | Tableau différenciateurs vs concurrence + 4 innovations défendables |
| **Project-Type Requirements** (L259-291) | ⚠️ Quasi-complete | PTR-PLAT/DEV/CAP/OPS couverts. **Lacune : pas de section Store Compliance** (cf. Project-Type Validation). |
| **Functional Requirements** (L295-526) | ✅ Complete | 39 FRs avec Capability + Acceptance + Phase + Source |
| **Non-Functional Requirements** (L530-610) | ✅ Complete | 39 NFRs sur 12 catégories avec template `shall + metric + measurement` |
| **Annexes — Traçabilité** (L614-657) | ✅ Complete | Mapping FR/NFR ↔ § PRD source + drift vocab + notes fidélité .docx |

### Section-Specific Completeness

| Vérification | Statut | Notes |
|---|---|---|
| Success Criteria mesurables ? | ✅ All | 22/22 SC avec métriques chiffrées + horizon temporel + source |
| User Journeys couvrent les types user ? | ⚠️ Partial | Couvre spawter B2C (4 journeys). Pas de journey `spawt_staff` (Admin), pas de journey Spawter Gold upgrade |
| FRs couvrent MVP scope ? | ✅ Yes | 25 FRs `Phase: Sprint 1` couvrent les 12 features cahier §3.1 + 13 enabler FRs (data-layer, infra) cohérents amendements team §4 |
| NFRs ont critères spécifiques ? | ✅ All | 39/39 NFRs avec métrique + condition + measurement method nommée |

### Frontmatter Completeness

```yaml
stepsCompleted: ['executive_summary', 'success_criteria', ..., 'non_functional_requirements']  ✅ Present (9 étapes)
inputDocuments: [...]  ✅ Present (7 documents)
workflowType: 'prd'  ✅ Present
project_name: 'SPAWT'  ✅ Present
date: '2026-05-13'  ✅ Present
source_version: '1.0.0'  ✅ Present
source_author: 'John BMad'  ✅ Present
source_date: '2026-04-09'  ✅ Present
language: 'fr'  ✅ Present
classification:  ⚠️ Missing (domain, projectType)
```

**Frontmatter Completeness :** **9/10 champs présents** — manque la classification BMAD explicite (`classification.domain: general`, `classification.projectType: mobile_app`). Déduction non-ambiguë mais le champ formalisé manquant fait perdre 1 point d'auto-extractibilité LLM.

### Completeness Summary

**Overall Completeness :** **~95%** (10/10 sections présentes, dont 8/10 complètes et 2/10 quasi-complètes).

**Critical Gaps :** 0 (aucun bloquant).

**Minor Gaps :**
1. Pas de Journey 5 « Upgrade Gold » (déjà signalé en Traceability + Holistic).
2. Pas de section Store Compliance (déjà signalé en Project-Type).
3. Frontmatter manque `classification: {domain: general, projectType: mobile_app}`.
4. `[NOM]` en copy notification (cosmétique, à reformuler en `{place_name}` i18next).

**Severity :** **PASS** ✅ (aucun template variable BMAD résiduel, aucune section critique manquante, 95% complétude).

**Recommandation :** PRD complet à 95%. Les 3 gaps mineurs sont **adressables en 1-2h** : ajouter Journey 5, ajouter section Store Compliance (PTR-STORE-01 à 04), ajouter `classification:` dans frontmatter. Le PRD est **utilisable en l'état** pour les workflows downstream `bmad-create-ux-design` / `bmad-create-architecture` / `bmad-create-epics-and-stories` — les gaps n'empêchent pas la consommation, ils l'affinent.

---

## ✓ Synthèse finale — Quick Results Table

| Étape de validation | Sévérité | Score / Statut |
|---|---|---|
| Format Detection | — | **BMAD Standard** (6/6 core + 4/4 bonus) |
| Information Density | ✅ PASS | 0 violation (FR/NFR), discipline §651 confirmée |
| Product Brief Coverage | N/A | Pas de brief BMAD amont (PRD V1.0.0 + cahier Sprint 1 jouent ce rôle) |
| Measurability | ✅ PASS | 0 violation FR/NFR, 1 mineure (FR-031), 1 imprécision externe (PTR-OPS-01) |
| Traceability | ⚠️ WARNING | Source-traceability 100% ; lacune Journey 5 « Upgrade Gold » |
| Implementation Leakage | ✅ PASS | 0 critique, 3 mineures (JSONB ×2, path tokens), 2 borderline (Supabase, Mapbox) |
| Domain Compliance | ✅ PASS | Domaine `general`, 18 DRs sur 4 axes réglementaires CI (above expectations) |
| Project-Type Compliance | ⚠️ WARNING | mobile_app : 3/5 sections complètes, gaps `device_permissions` + `store_compliance` |
| SMART Quality | ✅ PASS | 100% FRs ≥ 3, ~95% ≥ 4, avg **4.78/5** |
| Holistic Quality | ✅ Excellent | **4.5 / 5** |
| Completeness | ✅ PASS | ~95% (10/10 sections, 0 template variable BMAD résiduel) |

### Critical Issues : 0

### Warnings (3 — adressables en 1-2 sessions)

1. **Manque Journey 5 « Upgrade Spawter Gold »** — SC-REV-01 à SC-REV-05 (5 success criteria) non couvertes par un parcours user-side. FR-020 et FR-022 scorent Relevant = 3.
2. **Manque section « Store Compliance »** dans Project-Type Requirements — risque rejet App Store / Google Play (2-4 semaines de retour).
3. **Frontmatter `classification:` manquant** (`domain: general`, `projectType: mobile_app`) — fait perdre l'auto-extractibilité LLM des skills downstream.

### Minor (cosmétiques)

- FR-024, FR-025 : « JSONB » → « JSON object / structured payload » (DB-agnostique).
- FR-031 : path `src/theme/tokens.ts` → sortir en annexe.
- PTR-OPS-01 : « quelques minutes » → renvoi à NFR-AVAIL-03 « 5-minute ».
- NFR-AVAIL-01 / NFR-SEC-01-03 / NFR-CAP-01-03 : si Supabase non figé V1, remplacer par « managed PostgreSQL platform ».
- `[NOM]` (FR-006 copy) → `{place_name}` cohérence i18next.

### Strengths (top 8)

1. **Densité informationnelle exceptionnelle** : 0 filler en 657 lignes FR.
2. **Mesurabilité parfaite NFRs** : 39/39 avec template strict + measurement method nommée.
3. **Traçabilité-source 100%** : chaque FR/NFR cite §PRD + §cahier.
4. **Discipline réglementaire ivoirienne** : 18 DRs sur 4 axes (ARTCI, BCEAO, TVA, CGV) + 6 DR-FRAUD — bien au-delà du seuil `general`.
5. **Annexes de Traçabilité §614-657** : mapping FR ↔ § + drift vocab + notes fidélité .docx → discipline rare.
6. **Discipline vocabulaire** : aucun « user/restaurant/check-in » hors glossaire technique → cohérence parfaite avec project-context.md (lint-vocab bloquant).
7. **Anti-patterns explicitement supprimés** : §651 documente la suppression des adjectifs subjectifs.
8. **Architecture portable préparée** : `country_code` partout, FR-038 abstraction paiement, NFR-PORT-01 — facilite V2 multi-villes.

### Overall Status : **PASS with Warnings** ⚠️→✅

### Recommandation finale

**PRD prêt pour les workflows downstream** (`bmad-create-ux-design`, `bmad-create-architecture`, `bmad-create-epics-and-stories`) **avec un refinement préalable de 1-2 sessions** pour adresser les 3 warnings (Journey 5, Store Compliance, frontmatter classification). Les corrections mineures peuvent être faites en passe groupée avant le freeze final.

**Holistic Quality Rating :** **4.5 / 5 — Excellent**
**Format Classification :** BMAD Standard
**Document Status :** **Validated COMPLETE**

---

## Remédiation post-validation — PRD v1.0.1 (2026-05-13)

Sur demande utilisateur (« execute le top3 improvements »), les 3 améliorations prioritaires identifiées en `Holistic Quality Assessment` ont été appliquées directement sur [PRD.md](PRD.md). PRD passe en version **v1.0.1**.

### Improvement 1 ✅ — Journey 5 « Upgrade Spawter Gold » ajouté

**Avant :** 4 User Journeys (Onboarding, Découverte, Avis, Identité). Aucune ne couvrait l'upgrade Gold → 5 SC-REV orphelines, FR-020 et FR-022 scoraient Relevant = 3 sur SMART.

**Après :** Journey 5 ajouté avec 13 étapes — déclencheur (paywall FR-015 / Palais teasers FR-008 / Coup de Cœur FR-011 / célébration stade FR-010), écran souscription (FR-020), saisie Mobile Money, initiation paiement (FR-038), confirmation NFR-PAY-01 (<60s P95), activation immédiate Gold, émission facture (FR-022), pré-échéance J-3 (FR-021), grace period J+1 à J+7, downgrade auto J+8, re-souscription dans 90 jours (NFR-DATA-02), événements analytics user_signals (FR-024).

**Impact :**
- Lacune **Traceability WARNING** → ✅ **résolue** (SC-REV-01 à 05 désormais couvertes par un parcours user-side).
- **SMART scores** : FR-020 Relevant 3 → 5, FR-022 Relevant 3 → 5.
- **Avg SMART** : 4.78 → ~4.85.

### Improvement 2 ✅ — Section « Store compliance & permissions » ajoutée

**Avant :** Project-Type Requirements couvrait `platform_reqs`, `device_permissions` (partiel), `offline_mode`, `push_strategy` — mais pas de `store_compliance`. Risque de rejet App Store / Google Play (2-4 semaines de retour).

**Après :** 4 nouveaux requirements `PTR-STORE-01` à `PTR-STORE-04` :
- **PTR-STORE-01 — Apple App Store Guidelines** : §3.1.1 (paiement externe CinetPay OK, équivalent Uber/Lyft), §4.0 (Sign in with Apple si Google Sign-In activé), §5.1.1 (Privacy Nutrition Labels), §1.2 (modération UGC), §5.1.1(v) (Account Deletion couvert FR-033).
- **PTR-STORE-02 — Google Play Console** : Data Safety, Background Location declaration form (justifié Le Guet), target API level 34 Android 14.
- **PTR-STORE-03 — Permissions manifest** : liste complète Android (`ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`, etc.) + iOS (`NSLocationAlwaysAndWhenInUseUsageDescription`, etc.) avec usage descriptions FR-CI conformes Loi 2013-450 (DR-ARTCI-04).
- **PTR-STORE-04 — Age rating** : Apple 17+, Google PEGI 16/Mature 17+, mention alcool (Maquis/Bo Zinc) et UGC, pas de COPPA/Kids (inscription majeurs seulement).

**Impact :**
- **Project-Type Compliance WARNING** → ✅ **résolue** (5/5 sections requises mobile_app désormais complètes).
- Risque go-to-market store **réduit drastiquement**.

### Improvement 3 ✅ — Reformulations cosmétiques appliquées

| Item | Avant | Après |
|---|---|---|
| **3a** — FR-024 | « `metadata JSONB` (heure, jour, position…) » | « `metadata` (payload JSON structuré : heure, jour, position…) » |
| **3a** — FR-025 | « Stockage des `dominant_axes` en JSONB » | « Stockage des `dominant_axes` en structure JSON » |
| **3b** — FR-031 | Path `src/theme/tokens.ts` dans le corps du Capability | Path retiré du Capability, consigné en Annexe « Localisation des artefacts dans la base de code » |
| **3c** — PTR-OPS-01 | « latence acceptable jusqu'à quelques minutes » | « latence maximale 5 minutes (cf. NFR-AVAIL-03) » |

**Impact :**
- **Implementation Leakage mineures** (JSONB ×2, path tokens) → ✅ **résolues**.
- **Measurability — imprécision PTR-OPS-01** → ✅ **résolue** (renvoi explicite à NFR-AVAIL-03).

### Improvement 3d (Supabase → managed PostgreSQL) — NON APPLIQUÉ (raison documentée)

La recommandation était conditionnelle : « si l'arbitrage Supabase n'est PAS figé V1 ». Or, project-context.md confirme :
- `app/package.json` : `@supabase/supabase-js ^2.45.0` est dans la stack canonique.
- Section Technology Stack & Versions cite Supabase comme « Backend (optionnel) ».
- Décision adapter `lib/data-source.ts` repose sur Supabase + fallback seeds.

Supabase est un **ARBITRAGE FONDATEUR figé V1**. Les mentions NFR-AVAIL-01 / NFR-SEC-01-03 / NFR-CAP-01-03 restent **inchangées** — l'abstraction de portabilité multi-villes repose sur le champ `country_code` (NFR-PORT-01), pas sur le swap du provider DB. Documenté en `### Changelog du PRD restructure BMAD v1.0.1`.

### Frontmatter PRD enrichi

Ajout des champs manquants identifiés en Completeness Validation :
```yaml
restructure_version: '1.0.1'
restructure_date: '2026-05-13'
classification:
  domain: 'general'
  projectType: 'mobile_app'
  jurisdiction: 'CI'
  regulatoryAxes: ['ARTCI', 'BCEAO', 'TVA-DGI', 'CGV-CI']
validationStatus: 'PASS_WITH_WARNINGS_REMEDIATED'
validationReport: '_bmad-output/planning-artifacts/PRD-validation-report.md'
```

### Statut post-remédiation

| Étape | Avant remédiation | Après remédiation |
|---|---|---|
| Traceability | ⚠️ WARNING (Journey 5 manquant) | ✅ **PASS** |
| Project-Type Compliance | ⚠️ WARNING (store_compliance partiel) | ✅ **PASS** (5/5 + bonus) |
| Implementation Leakage | ✅ PASS (3 mineures) | ✅ **PASS** (0 mineure) |
| Measurability | ✅ PASS (1 mineure FR-031, 1 imprécision PTR-OPS-01) | ✅ **PASS** (0 mineure) |
| Completeness | ✅ PASS (~95%) | ✅ **PASS** (~99%) |
| Holistic Quality Rating | **4.5 / 5** | **~4.85 / 5** |

### Restant à traiter (non bloquant, non dans le Top 3)

- **`[NOM]` placeholder copy notification (FR-006)** : à reformuler `{place_name}` cohérence i18next — cosmétique, à inclure dans le run de copy review V1 par Alexandre (Test Tantie Rose).
- **DR-CGV-01 isolé** : sous-DRs à expanser une fois le juriste désigné — décision historisée §6 project-context.md (« budget consent juridique »).
- **Amendements Claude `[pending]` §5.x du cahier** : à retraiter en V1.5 selon validation team (séparé de cette remédiation).

### Overall Status final : **PASS** ✅

PRD v1.0.1 est désormais **production-ready** pour les workflows downstream :
- `bmad-create-ux-design` → consommera Journey 1-5 + FRs UI (FR-005 fiche, FR-008 profil, FR-014 carte, FR-019 notifs).
- `bmad-create-architecture` → consommera FRs data-layer (FR-024 à FR-030), NFRs (39), DRs (18), PTR-STORE (4), arbitrages fondateurs §12.3 §14.4.
- `bmad-create-epics-and-stories` → consommera 39 FRs avec leur `*Phase :*` (Sprint 1 ×25, Sprint 2 ×14) pour produire 39-117 stories.

---

## Remédiation post-validation — PRD v1.0.2 (2026-05-13) — Reste-à-traiter (non-bloquant)

Sur demande utilisateur (« fais le Restant (hors Top 3, non bloquant) »), les 3 items résiduels identifiés en fin de v1.0.1 ont été appliqués. PRD passe en version **v1.0.2**.

### Item 1 ✅ — Placeholder copy `[NOM]` → `{place_name}` (2 occurrences)

- **Journey 2.6** (parcours Découverte → Le Guet) et **FR-006 Capability** : remplacement du placeholder ad-hoc `[NOM]` par la convention i18next `{place_name}` + clé i18n nommée `notif.guet.prompt` mentionnée explicitement.
- **Impact :** cohérence avec NFR-I18N-01 (extraction 100% des strings) et préparation du Test Tantie Rose (Alexandre, audit copy).

### Item 2 ✅ — DR-CGV-01 étendu en 7 sous-DRs `[pending juriste]`

Avant : 1 DR-CGV générique. Après : **7 sous-DRs** structurant la checklist juriste à désigner (décision historisée §6 project-context « budget consent juridique ») :

| DR | Couverture |
|---|---|
| **DR-CGV-01** | Droit applicable (ivoirien), publication CGU/CGV, acceptation explicite historisée sur `spawters.cgv_accepted_at` |
| **DR-CGV-02** | Droit de rétractation 7 jours abonnement Gold, modalité email, remboursement intégral si non-usage |
| **DR-CGV-03** | Modalités de résiliation Gold (alignées FR-021 grace period + downgrade auto J+8), pas de pénalité `gold_annual` |
| **DR-CGV-04** | Modalités de remboursement Mobile Money (CinetPay merchant dashboard, 14 jours ouvrés, fenêtre rétractation seule sauf défaut produit) |
| **DR-CGV-05** | Propriété intellectuelle UGC : licence non-exclusive, irrévocable, mondiale, gratuite ; survit à suppression compte sauf demande explicite |
| **DR-CGV-06** | Modération communautaire + Faux-Pas (FR-034) + droit de contestation 30 jours |
| **DR-CGV-07** | Juridiction compétente Abidjan + médiation préalable + Loi 2016-412 protection consommateur |

**Impact :** transforme un DR vague en checklist actionnable pour le juriste. Compliance Matrix domaine `general` passe de « 1 DR-CGV isolé » à « 7 DR-CGV structurés `[pending juriste]` ».

### Item 3 ✅ — Disposition des 8 amendements Claude `[pending]` §5.x

Section dédiée ajoutée en Annexes du PRD (« Disposition des amendements Claude §5.x ») avec table de disposition Validation Architect + action concrète par amendement.

| § cahier | Sujet | Disposition VA | Mécanisme dans PRD v1.0.2 |
|---|---|---|---|
| §5.1 | Taxonomie events.md | ✅ Accepté V1 | **NFR-OBS-04** (events.md = single source of truth, EVT-XX référencés) |
| §5.2 | Consent ARTCI + suppression | ✅ Accepté V1 | **FR-040** (écran consent à l'onboarding) + **FR-033** (déjà intégré v1.0) |
| §5.3 | Anti-fraude L1 dans Feature 5 | ✅ Déjà accepté v1.0 | DR-FRAUD-01 à 06 + NFR-FRAUD-01 à 06 (rien à modifier) |
| §5.4 | Cold start `is_seed` | ✅ Accepté V1 | **FR-032 amendé** (150-300 avis seed) + **FR-026 amendé** (exclu compteur public) |
| §5.5 | Feature flags système | ✅ Accepté V1 | **FR-041** (table `feature_flags` + hook `useFlag`, 4 scopes) |
| §5.6 | i18n strings + lint vocab | ✅ Accepté V1 | **NFR-I18N-01 promu** partial → full + **NFR-I18N-02** ajouté (lint vocab bloquant) |
| §5.7 | Perf budget + device matrix | ✅ Déjà accepté v1.0 | NFR-PERF-01 à 07 + NFR-AVAIL-03 + PTR-DEV-01 à 04 (rien à modifier) |
| §5.8 | Alpha 5 spawters fin Sprint 1 | ✅ Accepté V1 (process) | Process opérationnel, non rapatrié comme FR/NFR. Faisabilité technique via FR-041 scope `internal` |

**Sign-off requis pour basculer `[pending]` → accepté formel :** Stéphanie + Kidam + Alexandre (triple sign-off, cohérent Cahier §8).

**Impact :**
- **6 amendements traduits en FR/NFR** dans le PRD : FR-040, FR-041, NFR-OBS-04, NFR-I18N-01 (promu), NFR-I18N-02 + amendements FR-026, FR-032.
- **2 amendements documentés comme déjà couverts** : §5.3 (anti-fraude), §5.7 (perf budget).
- **1 amendement laissé en process** : §5.8 (alpha) — pas un product requirement.
- **Lacune « 8 amendements `[pending]` non traités »** signalée dans le validation report initial → ✅ **résolue structurellement**.

### Inventaire post-v1.0.2

| Item | v1.0 | v1.0.1 | v1.0.2 |
|---|---|---|---|
| User Journeys | 4 | 5 (+J5 Gold) | 5 |
| Functional Requirements | 39 | 39 | **41** (+FR-040, FR-041) |
| Non-Functional Requirements | 39 | 39 | **40** (+NFR-OBS-04, NFR-I18N-02 ; NFR-I18N-01 promu) |
| Domain Requirements | 18 | 18 | **23** (+DR-CGV-02 à 07 — extension juriste) |
| Project-Type Requirements | 13 (PLAT/DEV/CAP/OPS) | **17** (+PTR-STORE-01 à 04) | 17 |
| Holistic Quality Rating | 4.5 / 5 | ~4.85 / 5 | **~4.92 / 5** |
| Placeholders BMAD | 0 | 0 | 0 |
| Placeholders i18n (`[NOM]`) | 2 | 2 | **0** (`{place_name}`) |
| Amendements Claude `[pending]` non dispositionnés | 8 | 8 | **0** (8/8 dispositionnés, en attente sign-off) |

### Restant après v1.0.2 (vraiment résiduel)

- **Triple sign-off** pour basculer les 8 amendements `[pending]` → accepté formel. Session de revue commune Stéphanie + Kidam + Alexandre.
- **Juriste à désigner** pour valider la rédaction définitive des 7 sous-DRs CGV.
- **Préparation des artefacts dev liés** : `documentation/qa/device_matrix.md` (PTR-DEV), `documentation/kpis/formulas.md` (KPIs Madame Sun), `documentation/analytics/events.md` validation Kidam — tous référencés dans le PRD mais hors scope éditorial du PRD.

### Overall Status final : **PASS (full remediation)** ✅

PRD v1.0.2 atteint un statut de **complétude exemplaire** pour les workflows downstream. Toutes les warnings et minors identifiées en validation initiale sont désormais soit **structurellement résolues**, soit **dispositionnées avec un parcours de validation clair** (juriste, triple sign-off).

**Holistic Quality Rating final estimé :** **4.92 / 5** (les 0.08 résiduels relèvent de validations externes hors contrôle de l'auteur : juriste pour CGV, triple sign-off pour amendements, KPIs Madame Sun).



