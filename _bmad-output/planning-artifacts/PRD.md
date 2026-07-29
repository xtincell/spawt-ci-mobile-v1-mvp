---
stepsCompleted: ['executive_summary', 'success_criteria', 'product_scope', 'user_journeys', 'domain_requirements', 'innovation_analysis', 'project_type_requirements', 'functional_requirements', 'non_functional_requirements']
inputDocuments:
  - documentation/SPAWT_PRD_V1.docx
  - documentation/SPRINT_1_CAHIER_DES_CHARGES.md
  - documentation/personas/stephanie.md
  - documentation/personas/kidam.md
  - documentation/personas/alexandre.md
  - documentation/personas/moka.md
  - documentation/analytics/events.md
workflowType: 'prd'
project_name: 'SPAWT'
date: '2026-05-13'
source_version: '1.0.0'
source_author: 'John BMad'
source_date: '2026-04-09'
restructure_version: '1.0.3'
restructure_date: '2026-05-14'
lastEdited: '2026-05-14'
editHistory:
  - date: '2026-05-14'
    changes: 'Erratum v1.0.3 post-bmad-check-implementation-readiness — FR-031 palette/typo réalignées sur le kit canonique documentation/ux/, bloc brand canonique ajouté en Annexe, convention des références § explicitée, drift vocabulaire « VTC » documenté, comptes corrigés (41 NFRs / 24 DRs). Aucune exigence ajoutée, retirée ou re-scopée.'
language: 'fr'
classification:
  domain: 'general'
  projectType: 'mobile_app'
  jurisdiction: 'CI'
  regulatoryAxes: ['ARTCI', 'BCEAO', 'TVA-DGI', 'CGV-CI']
validationStatus: 'PASS_WITH_WARNINGS_REMEDIATED'
validationReport: '_bmad-output/planning-artifacts/PRD-validation-report.md'
---

# Product Requirements Document — SPAWT

**Auteur original :** John BMad (PRD V1.0.0, 2026-04-09, `documentation/SPAWT_PRD_V1.docx`)
**Restructure BMAD :** Claude (2026-05-13), pour consommation `bmad-validate-prd`, `bmad-create-ux-design`, `bmad-create-architecture`, `bmad-create-epics-and-stories`.
**Amendements team intégrés :** `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §4.1 → §4.7 (séparation `spawters`/`spawt_staff`, table `customers`, table `plans`, table `currencies`, champs `country_code`/`origin_country_code`/`gender`/`age_range` sur `spawters`, politique overwrite, clarifications check-in).
**Amendements Claude :** **NON intégrés** (statut `[pending]` — voir `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §5.1 à §5.8). À retraiter après validation team.
**Vocabulaire canonique :** spawter, lieu, spawt (verbe + nom), Le Guet, Palais, ADN du Lieu, Stade, Archétype, Mue, Voix du chat, Coup de Cœur, La Meute, Djidji, Pépite Vérifiée. Aucun usage de : user, restaurant, check-in (sauf glossaire technique), leaderboard, gamification.

---

## Executive Summary

SPAWT est un compagnon de découverte culinaire communautaire pour les spawters d'Abidjan. La promesse : « Ne plus jamais regretter un lieu. » SPAWT réduit le temps de décision pour choisir où manger d'une cible de 45 minutes à 3 minutes, en filtrant l'offre massive (15 000+ points de restauration à Abidjan, 847 dans un rayon 5 km autour de Cocody) par un profil gustatif personnel — le Palais — calibré sur le comportement réel du spawter.

**Différenciateurs uniques (non reproductibles par Google Maps, TripAdvisor, Foursquare, Yelp) :**

- **Le Guet** — mécanisme de spawt type VTC (périmètre 10 m, timer 15 min, fenêtre +30 min post-sortie, snooze max 3x) qui prouve la présence physique du spawter sans interrompre l'expérience culinaire. Source PRD §7.1, §3.1 Feature 5.
- **Le Palais** — profil gustatif à 5 axes bipolaires (Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table) qui évolue par décroissance exponentielle à chaque spawt, jamais figé. Source PRD §5.1, §5.6.
- **L'ADN du Lieu** — profil multidimensionnel à 5 axes (Local/International, Informel/Établi, Budget/Premium, Populaire/Privé, Décontracté/Habillé) construit organiquement par les avis pondérés, contrôlé par la communauté pas par le restaurateur. Source PRD §6.1.
- **Voix du chat évolutive** — mascotte féline qui adapte son ton aux 5 stades du spawter (Touriste → Explorateur → Détective → Djidji → Guide). Source PRD §9.3.
- **Anti-leaderboard structurel** — Contrat à la Tribu : pas de classement, pas de compétition entre spawters. L'identité (qui tu ES via titre Palais×Maturité) prime sur l'utilité (recommandation). Source PRD §20.1, §18.1 tension 8.
- **Made in Abidjan** — vocabulaire nouchi (Djidji, Gbonhi), pricing FCFA, paiement Mobile Money agrégé via CinetPay (Orange Money, Wave, MTN MoMo), fiches pré-chargées en Mission 1 (20 lieux), conformité ARTCI / Loi 2013-450.

**Cibles utilisateurs V1 (Phase 1 — Abidjan, 6 M habitants, pénétration smartphone >50%) :**

| Persona | Rôle dans la stratégie | Source PRD |
|---|---|---|
| Betsy Diomandé — La Superfan (event-go-er, 27-33 ans, Assinie) | PERSONA CORE — 70% des décisions produit, premium driver | §2.1 |
| Dominic Koffi — Le Jeune Fêtard (18-24 ans, Yopougon) | Canal d'acquisition (TikTok), freemium only | §2.1 |
| Brice Konan — Le Professionnel Établi (32-39 ans, Cocody) | Persona premium qualité > quantité | §2.1 |
| Vanessa Kouakou — L'Influenceuse (25-31 ans, Marcory) | Levier marketing, statut Ambassadrice séparé | §2.1 |
| Tantie Rose, Le Bo Zinc, Assinie Beach Club | Personas B2B Pro/Gold (V1.5+) | §2.2 |

**Phasage :** V1 (Abidjan, B2C only, 4-6 mois, 2-3 devs + 1 designer) → V1.5 (M8 : B2B Pro, 8 archétypes supplémentaires, Mode Rapide/Explore, 5 badges, ambassadeur formalisé) → V2 (M12+ : ML matching, Mode Crew, multi-villes Dakar, B2B Gold, Wrapped).

---

## Success Criteria

Métriques SMART traçables au funnel AARRR B2C (PRD §16.1) et à la distribution cible des stades à M12 (PRD §16.4). Les NFRs (section ci-dessous) couvrent les seuils techniques ; ici on borne les outcomes business.

### Acquisition

- **SC-ACQ-01 :** SPAWT atteint 25 000 downloads cumulés mensuels à M12 (jalons : 2K à M3, 10K à M6). Source PRD §16.1.
- **SC-ACQ-02 :** Le CAC blended reste sous 2 000 FCFA à M3, M6 et M12. Source PRD §16.1.
- **SC-ACQ-03 :** À M12, la mix d'acquisition respecte 40% organic, 25% referral, 15% paid, 20% other. Source PRD §16.1.

### Activation

- **SC-ACT-01 :** 70% des spawters qui ouvrent l'app complètent l'onboarding (5 questions calibrage Palais). Source PRD §16.1.
- **SC-ACT-02 :** 40% des spawters qui cliquent sur leur premier lieu réalisent leur premier spawt vérifié. Source PRD §16.1.
- **SC-ACT-03 :** Le taux d'activation J+7 (premier spawt complété dans les 7 jours suivant l'inscription) atteint 60% à M3. Source PRD §16.1.

### Rétention

- **SC-RET-01 :** Rétention M1 ≥ 50%, M3 ≥ 35%, M6 ≥ 25%, M12 ≥ 20%. Source PRD §16.1.
- **SC-RET-02 :** Le spawter actif réalise en moyenne 3,5 sessions / semaine, durée moyenne 7 min / session. Source PRD §16.1.
- **SC-RET-03 :** À M12, la distribution des spawters actifs respecte 40% Touriste, 35% Explorateur, 15% Détective, 8% Djidji, 2% Guide. Source PRD §16.4.

### Référence virale

- **SC-REF-01 :** 30% des spawters référent au moins 1 personne via partage WhatsApp dans les 90 jours suivant leur inscription. Source PRD §16.1.
- **SC-REF-02 :** Coefficient viral ≥ 1,4 à M12. Source PRD §16.1, §10.3 fonction VIRALISER.
- **SC-REF-03 :** Taux de conversion des referrals (download depuis un partage WhatsApp → premier spawt) ≥ 25%. Source PRD §16.1.

### Revenue

- **SC-REV-01 :** Taux de conversion Spawter Gold ≥ 5% à M6, ≥ 8% à M12. Source PRD §16.1.
- **SC-REV-02 :** Churn premium mensuel < 5% à M6 et M12. Source PRD §16.1.
- **SC-REV-03 :** ARPU mensuel ≥ 2 200 FCFA à M6, ≥ 2 500 FCFA à M12. Source PRD §16.1.
- **SC-REV-04 :** Ratio LTV/CAC ≥ 3,5x à M6 et M12. Source PRD §16.1.
- **SC-REV-05 :** MRR B2C ≥ 1,25 M FCFA à M12 (500 Spawter Gold). ARR Potentiel M12 ~30 M FCFA. Source PRD §11.5, §16.3.

### Inventaire data (cold start)

- **SC-INV-01 :** Base de lieux ≥ 100 à M3, ≥ 300 à M6, ≥ 800 à M12. Source PRD §16.3.
- **SC-INV-02 :** Volume de spawts ≥ 50/jour à M3, ≥ 200/jour à M6, ≥ 500/jour à M12. Source PRD §16.3.
- **SC-INV-03 :** Volume d'avis ≥ 20/jour à M3, ≥ 80/jour à M6, ≥ 200/jour à M12. Source PRD §16.3.
- **SC-INV-04 :** Au lancement, la carte n'est jamais vide : 50-100 lieux pré-chargés avec 20 lieux onboardés en Mission 1 (Date night/Premium, Dabali, Boys/Barbecue, Nouveaux, Hype, Sceptiques). Source PRD §17.1 Phase 4, §20.8.

---

## Product Scope

Trois horizons de livraison conformes au phasage PRD §17.1 (plan livraison) et §4.2 (roadmap post-MVP). Le périmètre Sprint 1 (12 features sur 19) est figé par `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §3.1.

### MVP — V1 (Lancement Abidjan, 4-6 mois)

**Brique data centrale + boucle découverte → spawt → avis → Palais évolutif. B2C only.**

19 features PRD §3.1 dont 12 priorisées Sprint 1 (cahier §3.1) :

- **Sprint 1 (semaine 1-11) :** Inscription/Auth OTP, Onboarding calibrage Palais, Feed personnalisé, Fiche lieu, Le Spawt (Le Guet), Avis structuré, Profil, 5 stades, Favoris, Recherche/Filtres, Partage WhatsApp, Admin panel.
- **Sprint 2 (semaine 8-16, parallèle) :** Carte interactive Mapbox, Coup de Cœur, Notifications push, Paywall géographique (3 km gratuit / tout Abidjan premium), Paiement Mobile Money (CinetPay → Orange Money/Wave/MTN MoMo), Modération basique, Création de fiche lieu (équipe), Archétypes & mues (5 archétypes MVP : Pisteur, Bouche d'Or, Gardien du Maquis, Vent d'Ailleurs, Omnivore).
- **Badges Sprint 1 :** 1 seul badge `Premier Spawt` (verrou activation). 4 autres badges MVP (Traversée, Noctambule, Chasseur de Pépites, Palais Diversifié, Éclaireur) reportés V1.5 par cahier §3.2.
- **Pre-charge inventaire :** 50-100 lieux dont 20 onboardés Mission 1 par les Allies terrain.

### Growth — V1.5 (M8, ~2 mois après lancement)

Source PRD §4.2 et cahier §3.2.

- 8 archétypes additionnels (total 13) : Fantôme, Mémoire, Feu de Braise, Œil de Chat, Murmure, Lame, Passeport Doré, Ancre.
- 4 badges MVP restants (Traversée, Noctambule, Chasseur de Pépites, Palais Diversifié, Éclaireur).
- Mode Rapide (swipe cards) si pattern validé en V1.
- Mode Explore (magazine scroll) avec UGC suffisant.
- Tier B2B `Spawt Pro` (15 000 FCFA HT/mois) avec badge Vérifié, réponses aux avis, Le Carnet éditorial, dashboard basique.
- Bridge digital Allies : community managers terrain gèrent 5-10 fiches Pro pour les lieux non-digitalisés (Tantie Rose).
- Share card auto-générée (type Wrapped) sur partage WhatsApp.
- Programme ambassadeur formalisé (3 paliers) pour Vanessa et profils Influenceur.
- Landing page web SEO/ASO.
- Coup de Cœur visible sur la fiche lieu (signal social).

### Vision — V2+ (M12+, ~6 mois après lancement)

Source PRD §4.2.

- Matching ML à 4 dimensions (nécessite 10K+ spawts accumulés via la table append-only `user_signals`, PRD §13.3) : ajout dimensions colonie (profils similaires) + contexte avancé (météo, événements, historique temporel).
- Mode Crew (vote temps réel, websockets, sessions synchrones).
- Cartes collectibles / Plats (4 niveaux de rareté).
- Réservation 1-tap.
- Tier B2B `Spawt Gold` (65 000 FCFA HT/mois) : visibilité contextuelle, analytics avancés, ciblage par archétype, benchmark anonymisé.
- Paws (monnaie d'activité).
- Multi-villes Dakar, puis Afrique de l'Ouest francophone (Douala, Lagos, Accra). Architecture portable dès V1 (Décision PRD §18.1 tension 5).
- SPAWT Wrapped (bilan annuel à M18).

---

## User Journeys

Quatre parcours principaux. Chacun trace les FRs qui le composent (mapping section Functional Requirements ci-dessous).

### Journey 1 — Onboarding & calibrage du Palais

1. Un nouveau spawter télécharge l'app et l'ouvre (SC-ACT-01 cible : 70% complètent).
2. Écran consentement géolocalisation explicite (PRD §20.7 — consent ARTCI requis ; flow détaillé en V1.5 si amendement Claude 5.2 accepté).
3. Authentification par numéro de téléphone + OTP (méthode primaire, standard CI) ou Google Sign-In en secondaire. FR-001.
4. Saisie quartier de résidence, type de cuisine préféré, budget habituel, contexte principal (solo/groupe). FR-002.
5. 5 questions de calibrage (une par axe bipolaire du Palais) — voir PRD §20.2. Génère un Palais initial avec scores entre -40 et +40 (échelle -100 à +100), laissant 60% de la plage pour le calibrage comportemental. FR-002.
6. Présentation immédiate du Palais initial + premier titre + voix du chat ton Touriste : « Bienvenue. Ton Palais est vierge. Chaque spawt le dessine un peu plus. On y va ? ». FR-003.

### Journey 2 — Découverte → Fiche → Le Spawt

1. Le spawter ouvre l'app, arrive sur le feed personnalisé ordonné par score composite (FR-004) : `0.15 × cosine(Palais, ADN) + 0.30 × distance + 0.30 × note pondérée + 0.10 × recency + 0.15 × novelty`. Source PRD §8.1.
2. Score affiché en pourcentage 50%-99% sur chaque fiche (formule `50 + score × 49`). Source PRD §8.3.
3. Le spawter ouvre une fiche lieu (FR-005) : photo, nom, quartier, type cuisine, fourchette prix, note communautaire pondérée, horaires, adresse, bouton Appeler + bouton WhatsApp, radar ADN si ≥5 avis, badges spéciaux (Pépite Vérifiée, Institution, Coup de Cœur, etc.).
4. Le spawter sauvegarde le lieu en favori (FR-009) ou partage la fiche sur WhatsApp avec deep link image + nom + note (FR-016).
5. Le spawter se rend physiquement au lieu. Détection passive de présence dans un périmètre de 10 m (FR-006 — Le Guet).
6. Après 15 min en zone, notification locale forcée : « Comment c'était chez {place_name} ? » (clé i18n `notif.guet.prompt`). Le spawter peut snooze (max 3 fois). Fenêtre +30 min après sortie de zone. Check-in passif si aucune réponse (poids 0,5x).
7. Le spawter confirme le spawt — durée cible <30 s pour un spawt simple, <2 min avec avis.

### Journey 3 — Avis structuré post-spawt

1. Après confirmation du spawt, le spawter accède à l'écran avis (FR-007).
2. Note globale étoiles 1-5 (obligatoire si avis).
3. Tags rapides à sélection multiple : « Copieux », « Rapide », « Ambiance top », « Cher », « À refaire ».
4. Texte libre optionnel (max 500 caractères).
5. 1 à 3 photos optionnelles.
6. Le poids algorithmique de l'avis dépend du stade du spawter : Touriste 1x, Explorateur 1,5x, Détective 2x, Djidji 2,5x, Guide 3x. Source PRD §3.1 Feature 6, §7.2.
7. L'avis met à jour l'ADN du Lieu via mapping signaux (PRD §20.5) et le Palais du spawter via décroissance exponentielle (`facteur_apprentissage = max(0.05, 1.0 / (1 + n_spots × 0.05))`). Source PRD §5.6.

### Journey 4 — Identité spawter (Profil + Palais + collection titres)

1. Le spawter consulte son profil (FR-008) : nom, avatar, quartier, stade actuel, titre actuel et titre affiché (peuvent différer), nombre de spawts, avis donnés, lieux sauvegardés.
2. Le Palais radar : 2 axes visibles en gratuit, 5 axes complets en Spawter Gold (paywall FR-014).
3. Collection de titres permanente — chaque montée de stade ou mue ajoute un titre. PRD §5.4.
4. À chaque seuil de spots uniques franchi (10, 20, 30, 50), montée de stade : écran de célébration dédié + nouveau titre + ajustement de la voix du chat (Touriste enjoué → Explorateur complice → Détective grave → Djidji solennel → Guide silencieux). FR-010.
5. Si les 2 axes dominants du Palais restent stables 30 jours et 5 spots minimum dans une nouvelle direction → mue d'archétype (constat neutre, pas promotion) : voix du chat « Je te sens différent. Tes 30 derniers spots disent Fantôme plus que Pisteur. ». PRD §5.5.
6. Coup de Cœur (FR-011) : 1/mois pour Touriste/Explorateur/Détective, 2/mois Djidji, 3/mois Guide (+1 bonus Spawter Gold). Signal social rare indexé sur la maturité du spawter, pas sur le portefeuille. PRD §3.1 Feature 12, §18.1 tension 4.

### Journey 5 — Upgrade Spawter Gold (souscription, paiement, grace period, downgrade)

Couvre SC-REV-01 à SC-REV-05 (conversion Gold ≥5% M6 / ≥8% M12, churn <5%, ARPU 2 200-2 500 FCFA, LTV/CAC ≥3,5x, MRR 1,25 M FCFA M12). Source PRD §3.1 Feature 15, §11.2, §11.4, §13.8, §14.2 ; FR-015, FR-020, FR-021, FR-022, FR-038.

1. **Déclencheur d'upgrade.** Le spawter rencontre un point de friction Gold-aware parmi : (a) un lieu hors zone 3 km floutée sur le feed ou la carte avec mention « PREMIUM — 2 950 F/mois TTC — Tout Abidjan » (FR-015), (b) un radar Palais limité à 2 axes sur son profil avec teaser « 3 axes cachés » (FR-008), (c) la consommation de son seul Coup de Cœur mensuel avec mention du bonus Gold +1 (FR-011), (d) un écran de célébration de stade avec un encart Gold (FR-010, ton chat non-pushy).
2. **Écran de souscription Spawter Gold (FR-020).** Comparatif gratuit vs Gold (Palais 5 axes, tout Abidjan, +1 Coup de Cœur, badge doré, listes curatées illimitées, analytics Palais dans le temps). Choix `gold_monthly` 2 500 F HT/mois (2 950 F TTC) ou `gold_annual` 25 000 F HT/an (29 500 F TTC, 2 mois offerts). Source `plans` table FR-029.
3. **Saisie provider Mobile Money.** Le spawter sélectionne son canal : Orange Money (P0), Wave (P0), MTN MoMo (P1). Saisie du numéro de téléphone payeur (peut différer du numéro de compte SPAWT). Validation format.
4. **Initiation paiement CinetPay (FR-038, FR-020).** L'application invoque `IPaymentProvider.initiate({plan_id, customer_id, payment_method})`. CinetPay déclenche l'OTP USSD côté provider (Orange Money) ou l'app-to-app (Wave) ou la confirmation push (MTN MoMo). Le spawter confirme côté provider hors-app.
5. **Confirmation paiement (NFR-PAY-01).** La confirmation revient sous 60 secondes pour 95% des transactions. Pendant l'attente : écran loader avec voix du chat ton calme-confiant (ex : Explorateur complice « Patience, le réseau respire. »). Pas de timeout brutal — fallback consultation manuelle de statut.
6. **Activation immédiate des avantages Gold.** Dès l'ACK CinetPay : (a) `customers` row créée / mise à jour, `subscriptions` row insérée (FR-028), (b) badge doré apparaît sur le profil, (c) tout Abidjan visible (paywall FR-015 levé), (d) Palais radar 5 axes débloqué (FR-008), (e) quota Coup de Cœur +1 (FR-011). Pas d'écran de célébration gamifié — la voix du chat marque le moment en ton solennel (proche Djidji) : « Tu fais partie de la Meute Gold. Pas plus, autrement. ».
7. **Émission facture (FR-022).** Facture séquentielle `SPAWT-2026-NNNN` générée dans les 30 secondes : envoi email + SMS avec lien PDF. Consultable depuis Profil → Mes factures (re-téléchargement permanent).
8. **Pré-échéance — J-3 (FR-021).** Push + SMS « Ton Gold expire dans 3 jours. Renouvelle. » avec deep link pré-rempli (plan, customer_id, montant). Pas de prélèvement automatique (impossible en Mobile Money agrégé V1).
9. **Jour J — échéance.** Push avec deep link de renouvellement. Si paiement effectué dans la journée : prolongation transparente.
10. **Grace period J+1 à J+7 (FR-021).** Bandeau jaune en tête d'écran « Ton Gold expire. Renouvelle. » sur toutes les vues. Les avantages Gold restent actifs.
11. **Downgrade J+8.** Bascule automatique vers gratuit : paywall géo FR-015 réactivé, Palais radar limité à 2 axes, quota Coup de Cœur normal. Les données premium (analytics Palais historique, listes curatées) sont **conservées masquées 90 jours** (NFR-DATA-02). Voix du chat ton neutre : « On se reverra Gold quand tu voudras. ».
12. **Re-souscription dans les 90 jours.** Restauration immédiate des données masquées dès confirmation paiement — reprise transparente comme si l'expiration n'avait pas eu lieu. Au-delà de 90 jours : restauration partielle (Palais conservé, analytics historique perdu).
13. **Acquisition AARRR Revenue.** Tous les événements de cette journey sont capturés en `user_signals` (FR-024) + Mixpanel/PostHog (NFR-OBS-02) : `gold_paywall_view`, `gold_screen_open`, `gold_subscribe_initiate`, `gold_subscribe_success`, `gold_subscribe_failure`, `gold_renewal_reminder_sent`, `gold_grace_period_enter`, `gold_downgrade_auto`. Conversion par cohorte (déclencheur d'upgrade) mesurée pour SC-REV-01.

---

## Domain Requirements

SPAWT collecte de la géolocalisation continue (Le Guet), des PII (numéro de téléphone, quartier, country_code, origin_country_code, gender, age_range, photos d'avis) et des paiements Mobile Money. Trois domaines réglementaires s'appliquent.

### Régulation données personnelles — Côte d'Ivoire

- **DR-ARTCI-01 :** Le service est déclaré à l'ARTCI (Autorité de Régulation des Télécommunications de Côte d'Ivoire) avant lancement public. Source PRD §20.7.
- **DR-ARTCI-02 :** Conformité à la Loi 2013-450 sur la protection des données personnelles (Côte d'Ivoire) : consentement explicite, droit d'accès, droit de suppression, stockage sécurisé, pas de transfert hors CI sans accord. Source PRD §20.7.
- **DR-ARTCI-03 :** Politique de confidentialité publique, accessible depuis Profil → Paramètres et avant tout consentement géoloc. Source PRD §20.7. Cahier §5.2 (Claude `[pending]`) propose un flow consent dès Sprint 1 — non intégré ici, retraiter après validation team.
- **DR-ARTCI-04 :** Consentement explicite préalable à toute collecte de géolocalisation (Le Guet ne démarre pas avant signature consent). Source PRD §20.7.
- **DR-ARTCI-05 :** Le spawter peut demander la suppression de son compte (soft-delete sur `spawters`, anonymisation après 30 jours) et l'export de ses données en self-service depuis Profil. Source cahier §5.2 amendement Claude `[pending]` — note : à confirmer en V1 même si amendement non encore signé, car PRD §20.7 l'impose pour conformité Loi 2013-450.

### Paiement Mobile Money — BCEAO / agrément intermédiaire

- **DR-BCEAO-01 :** SPAWT ne stocke pas de fonds. Tous les paiements transitent par CinetPay, intermédiaire agréé BCEAO. Pas d'agrément propre nécessaire. Source PRD §20.7.
- **DR-BCEAO-02 :** CinetPay émet les reçus de paiement ; SPAWT envoie une copie par email/SMS dans les 30 secondes suivant le paiement confirmé. Source PRD §20.7.

### Fiscalité — TVA 18% + facturation séquentielle

- **DR-TVA-01 :** TVA 18% applicable sur tous les services numériques B2C et B2B. Source PRD §14.2, §20.7.
- **DR-TVA-02 :** Affichage en application B2C : prix TTC (les consommateurs finaux raisonnent en prix final en CI). Affichage B2B : prix HT + ligne TVA explicite. Source PRD §11.2, §20.7.
- **DR-TVA-03 :** Déclaration TVA mensuelle à la DGI (Direction Générale des Impôts). Source PRD §20.7.
- **DR-TVA-04 :** Factures B2B numérotées séquentiellement au format `SPAWT-2026-NNNN`. Source PRD §13.8, §20.7.

### CGU/CGV — Droit ivoirien

> **Statut :** Sous-DRs structurées par Validation Architect post-restructure BMAD pour servir de checklist au juriste à désigner (décision historisée §6 du project-context — « budget consent juridique »). Chaque DR-CGV-XX porte la mention `[pending juriste]` jusqu'à validation formelle de la rédaction définitive. Aucune des sous-DRs n'engage le projet sur des termes juridiques exacts ; elles définissent **les points à couvrir**, pas leur formulation contractuelle.

- **DR-CGV-01 :** Le service est régi par le **droit ivoirien**. Les CGU et CGV sont rédigées en français (langue officielle CI), publiées dans l'app sous Profil → Paramètres → CGU/CGV et sur la landing page web (FR-038 si V1.5+). Acceptation explicite requise à l'inscription (case à cocher non pré-cochée), historisée avec horodatage sur `spawters.cgv_accepted_at`. `[pending juriste]` Source PRD §20.7.

- **DR-CGV-02 :** Le **droit de rétractation** s'applique aux abonnements Spawter Gold (FR-020) : 7 jours calendaires à compter de la souscription, durée alignée sur les pratiques marchand B2C CI. Modalité d'exercice : email à un point de contact dédié (`support@spawt.ci` ou équivalent), traitement sous 14 jours. Remboursement intégral si rétractation effective et aucun usage des avantages Gold (à arbitrer juriste : usage partiel proratisé ?). `[pending juriste]` Source PRD §20.7 + FR-020.

- **DR-CGV-03 :** Les **modalités de résiliation Spawter Gold** sont conformes au flow technique FR-021 (grace period 7 jours post-échéance, downgrade auto J+8, conservation données 90 jours masquées NFR-DATA-02). Pas de pénalité de résiliation anticipée pour `gold_annual` (l'abonnement annuel court jusqu'à son terme contractuel sans renouvellement). Le spawter peut désactiver l'auto-rappel pré-échéance à tout moment. `[pending juriste]` Source PRD §11.4 ; FR-021 ; Journey 5.

- **DR-CGV-04 :** **Modalités de remboursement Mobile Money** — particularité technique : le paiement via CinetPay (Orange Money / Wave / MTN MoMo) n'est pas révocable par SPAWT côté provider après confirmation. Un remboursement = transfert sortant manuel via CinetPay merchant dashboard, traité sous 14 jours ouvrés. Aucun remboursement après expiration de la fenêtre de rétractation (DR-CGV-02), sauf cas de défaut produit qualifié (FR-038 mock provider failure, panne >24h, etc.). Politique à valider juriste vs Loi 2016-412 sur la protection du consommateur ivoirien. `[pending juriste]` Source PRD §11.4 + FR-038 + DR-BCEAO-01.

- **DR-CGV-05 :** **Propriété intellectuelle UGC (avis, photos, votes Coup de Cœur).** Le spawter conserve les droits moraux sur ses avis et photos. Il concède à SPAWT une **licence non-exclusive, irrévocable, mondiale et gratuite** d'utilisation, de reproduction, de modification (pour adaptation technique), de distribution et de communication publique de ces contenus dans le cadre exclusif du service SPAWT et de sa communication marketing (incluant share cards Wrapped V1.5+). La licence survit à la suppression du compte (sauf demande explicite d'effacement des contenus, à traiter sous 30 jours conformément DR-ARTCI-05). Les contenus retirés pour cause de Faux-Pas (FR-034) sont anonymisés et conservés à des fins d'audit modération. `[pending juriste]` Source PRD §20.7 ; FR-007, FR-017, FR-034.

- **DR-CGV-06 :** **Modération communautaire et règles de Faux-Pas** (Fake Review, Gatekeeping, Hater Toxique — PRD §19) sont opposables au spawter dès acceptation des CGU. Les sanctions Warning / BAN (FR-034) sont appliquées par `spawt_staff` selon une grille publique. Le spawter sanctionné peut **contester sous 30 jours** via le même canal email de rétractation. Décision finale par responsable modération SPAWT. La perte de l'accès suite à un BAN n'ouvre pas droit à remboursement de l'abonnement Gold en cours (à arbitrer juriste). `[pending juriste]` Source PRD §19 ; FR-017, FR-034 ; cahier §3.2.

- **DR-CGV-07 :** **Juridiction compétente** : en cas de litige non résolu via les canaux internes (DR-CGV-06 contestation, DR-CGV-04 remboursement), les **tribunaux d'Abidjan** sont compétents. Médiation préalable encouragée (associations de consommateurs CI, à identifier juriste). La clause d'arbitrage international n'est pas applicable au B2C (Loi 2016-412 protège le consommateur ivoirien d'une renonciation au tribunal compétent local). `[pending juriste]` Source PRD §20.7.

### Conformité Le Guet (anti-fraude technique)

Distinct de la modération humaine (FR-017). Source PRD §20.4. Cahier §5.3 (Claude `[pending]`) propose intégration en Feature 5 dès Sprint 1 — non intégré formellement ici, mais les règles restent obligatoires V1.

- **DR-FRAUD-01 :** Fréquence même lieu plafonnée à 1 spawt / 4 heures (doublon rejeté). Source PRD §20.4.
- **DR-FRAUD-02 :** Fréquence globale > 5 spawts / jour déclenche un flag automatique. Source PRD §20.4.
- **DR-FRAUD-03 :** Vitesse de déplacement entre 2 spawts > 100 km/h déclenche un flag automatique. Source PRD §20.4.
- **DR-FRAUD-04 :** Spawt sans géolocalisation marqué `is_verified = false`, poids 0,5x dans le calcul ADN et Palais. Source PRD §20.4.
- **DR-FRAUD-05 :** Pattern de 10+ spawts identiques en 7 jours flag le compte pour revue manuelle. Source PRD §20.4.
- **DR-FRAUD-06 :** Cohérence arrivée/départ : si `left_at - arrived_at < 5 min` ET check-in actif → flag suspect. Source PRD §20.4.

---

## Innovation Analysis

SPAWT se positionne en rupture avec les 3 catégories concurrentes (search universelle type Google Maps, communautaire occidentale type TripAdvisor/Foursquare, sociale-déclarative type Instagram). Le moat n'est pas l'inventaire (Google Maps en a plus) mais le filtre, l'identité et le contrat communautaire. Source PRD §1.5, §1.7, §20.1.

### Différenciateurs structurels (non réplicables sans refonte de positionnement)

| Différenciateur | Mécanique SPAWT | Ce que la concurrence fait | Source PRD |
|---|---|---|---|
| Recommandation personnalisée | Score composite Palais × ADN × distance × note pondérée × recency × novelty, évolutif par décroissance exponentielle | Mêmes 847 résultats pour tout le monde | §1.5, §8.1 |
| Présence prouvée | Le Guet — géoloc 10 m + timer 15 min + fenêtre +30 min, check-in passif si pas de réponse | Check-in déclaratif (Foursquare/Yelp) ou note sans présence (Google Maps) | §7.1, §3.1 Feature 5 |
| Profil utilisateur | Palais 5 axes bipolaires (instinct, jamais figé) + collection de titres permanente | Étoiles plates, badges décoratifs sans fonction | §5.1, §5.4 |
| Notation | Note pondérée par stade du votant (1x→3x) + signaux qualitatifs (tags, photos, texte) | Étoiles anonymes, poids uniforme | §3.1 Feature 6, §7.2 |
| Architecture sociale | **Anti-leaderboard structurel** — Contrat à la Tribu interdit le classement entre spawters | Leaderboards, rankings, compétitions saisonnières | §20.1, §18.1 tension 7 et 8 |
| Voix produit | Mascotte féline qui évolue avec le stade (5 tons distincts), parler nouchi accepté | Chatbots génériques, copy formel | §9.3, §15.5 |
| Ancrage géographique | Made in Abidjan : pricing FCFA, paiement Mobile Money agrégé CinetPay, vocabulaire local (Djidji, Gbonhi, Maquis), Mission 1 = 20 lieux iconiques onboardés terrain | Tech occidentale importée, USD/EUR, anglais | §1.1, §1.5, §20.8 |
| Bridge digital fracture | Allies SPAWT (community managers quartier) gèrent les fiches des lieux non-digitalisés (V1.5+) | Suppose un site web / page Insta préexistante | §11.3, §14.2 |
| Identité > Utilité | « L'utilité est le hook d'acquisition. L'identité est le moat de rétention. » | Optimisent uniquement l'utilité (search → fonctionnel) | §18.1 tension 8 |

### Innovation produit défendable

- **Le Palais** est un actif data unique à SPAWT : 5 axes bipolaires calibrés en continu sur chaque spawt, alimentés par 13 signal-mappings (PRD §20.5), avec confidence_score pour ne pas afficher de profil non-fiable.
- **L'ADN du Lieu** est contrôlé par la communauté pas par le restaurateur (PRD §6.1) : « Payer ne change pas ta note. Payer te donne de la compréhension (data) et de la voix (réponses aux avis). » Source PRD §20.1.
- **La table append-only `user_signals`** capture tous les signaux (spawt, review, view, save, share, search, filter, click, dismiss) dès V1 pour préparer le ML V2. Coût stockage négligeable, coût de migration si oublié énorme. Source PRD §8.4, §13.3.
- **L'interface IPaymentProvider abstraite** rend CinetPay remplaçable sans refactoring majeur. ARBITRAGE FONDATEUR explicite. Source PRD §12.3, §14.4.

---

## Project-Type Requirements

SPAWT est une application mobile B2C avec backend managé et panel admin web. Source PRD §12 + `docs/architecture-mobile-app.md` (brownfield post-Phase 0 Sprint 1).

### Plateformes cibles

- **PTR-PLAT-01 :** Application mobile native iOS + Android, livrée via App Store et Google Play. Source PRD §17.1 Phase 4.
- **PTR-PLAT-02 :** Panel admin web (CRUD lieux, modération signalements, métriques basiques). Source PRD §3.1 Feature 19.
- **PTR-PLAT-03 :** Pas de site web V1 (landing statique suffisante pour SEO/ASO ; landing complète en V1.5). Source PRD §4.2.

### Matrice de devices supportés (V1)

Source PRD §14.1 + cahier §5.7 amendement Claude `[pending]`.

- **PTR-DEV-01 :** Smartphones Android entrée de gamme (Tecno, Infinix) et milieu de gamme (Samsung Galaxy A) — Android 9+ minimum. Source PRD §14.1, §3.1.
- **PTR-DEV-02 :** Smartphones iPhone (modèles d'occasion à neufs disponibles à Abidjan). iOS 14+ minimum.
- **PTR-DEV-03 :** Stockage device cible <50 MB pour l'APK installé. Source PRD §14.1.
- **PTR-DEV-04 :** Connectivité variable : 3G stable, 4G intermittent selon quartier. Mode offline-tolerant requis (spawts stockés localement et synchronisés au retour réseau). Source PRD §14.1.

### Capabilités plateforme requises

- **PTR-CAP-01 :** Géolocalisation continue en background avec geofencing natif (basse consommation batterie). Source PRD §14.1, §3.1 Feature 5.
- **PTR-CAP-02 :** Notifications push locales (Le Guet) + push serveur (rappels paiement, montée de stade, mue). Source PRD §3.1 Feature 13.
- **PTR-CAP-03 :** Caméra accessible pour photos d'avis (max 3/avis, compression 80%, max 1 MB / image). Source PRD §3.1 Feature 6, §12.1.
- **PTR-CAP-04 :** Deep linking entrant et sortant (partage WhatsApp, deep link de renouvellement abonnement pré-rempli). Source PRD §3.1 Feature 16, §11.4.
- **PTR-CAP-05 :** Stockage local pour spawts en attente de synchronisation et données utilisateur essentielles (profil, favoris, Palais courant). Source PRD §14.1.
- **PTR-CAP-06 :** Internationalisation prête (i18n) : strings extraites, langue par défaut français Côte d'Ivoire (`fr-CI`). Source cahier §5.6 amendement Claude `[pending]`, partiellement implémenté Sprint 1 Phase 0.

### Contraintes opérationnelles cibles

- **PTR-OPS-01 :** Compatibilité avec l'agressivité des OEM Android (Tecno, Infinix, Samsung) tuant les apps en background : les geofences persistent au niveau OS, latence maximale 5 minutes (cf. NFR-AVAIL-03). Documentation in-app des paramètres batterie nécessaires. Source PRD §14.1.
- **PTR-OPS-02 :** Si batterie device < 10%, désactivation du monitoring GPS et bascule en mode spawt manuel. Source PRD §14.1.
- **PTR-OPS-03 :** Cartographie : style dark cohérent avec la direction artistique noir #0A0A0A. Source PRD §15.1, §3.1 Feature 11.

### Store compliance & permissions

Anticipation des Guidelines stores pour éviter les rejets de review (coût 2-4 semaines par rejet). Source FR-007 (photos d'avis), FR-006 (Le Guet géoloc background), FR-020 (paiement externe CinetPay), DR-ARTCI-04 (consent géoloc), §19 Faux-Pas (modération UGC).

- **PTR-STORE-01 — Apple App Store Guidelines.** Conformité aux sections critiques :
  - **§3.1.1 In-App Purchase** : SPAWT vend l'accès à un service tangible (découverte culinaire géolocalisée), comparable à Uber/Lyft. Le paiement externe via CinetPay/Mobile Money est **accepté par Apple** sans commission 30%. Pas d'IAP Apple requis pour Spawter Gold.
  - **§4.0 Sign in with Apple** : si Google Sign-In est exposé en méthode secondaire (FR-001), Apple impose Sign in with Apple comme option équivalente. **À livrer en V1** au même titre que Google Sign-In.
  - **§5.1.1 Privacy Nutrition Labels** : déclarer les données collectées (numéro de téléphone, localisation continue, gender, age_range, origin_country_code, country_code, photos, identifiants device) avec finalité « App Functionality » + « Analytics ». Source DR-ARTCI-02.
  - **§1.2 User Generated Content** : modération UGC obligatoire pour les avis et photos. FR-017 (signalement) + FR-034 (sanctions Faux-Pas) + un mécanisme de **block utilisateur** côté spawter (à ajouter V1.5 si demandé par Apple Review).
  - **§5.1.1(v) Account Deletion** : suppression self-service requise dans l'app. Couvert par FR-033.
  - Source : Apple App Store Review Guidelines (à jour 2026).

- **PTR-STORE-02 — Google Play Console.** Conformité :
  - **Data Safety section** : déclarer collecte (PII, location précise + approximative, photos, identifiants device), partage (CinetPay pour paiement, Sentry pour crash diagnostics, Mixpanel/PostHog pour analytics avec cohort tracking), pratiques de sécurité (RLS + TLS — NFR-SEC-01, NFR-SEC-03).
  - **Background Location declaration form** : justifier `ACCESS_BACKGROUND_LOCATION` par la feature Le Guet (FR-006). Démo vidéo de la fonctionnalité requise par Google.
  - **Target API level** : Android 14 (level 34) minimum pour les nouvelles publications post-août 2024.
  - **Health Connect / sensitive permissions** : non applicable V1.
  - Source : Google Play Console Policies (à jour 2026).

- **PTR-STORE-03 — Permissions manifest.** Liste explicite à intégrer dans `AndroidManifest.xml` (Android) et `Info.plist` (iOS), couplée au consent ARTCI explicite (DR-ARTCI-04) avant chaque collecte :
  - **Android :** `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (justifié Le Guet), `CAMERA`, `READ_MEDIA_IMAGES` (Android 13+) / `READ_EXTERNAL_STORAGE` (≤12), `POST_NOTIFICATIONS` (Android 13+), `INTERNET`, `WAKE_LOCK`.
  - **iOS :** `NSLocationAlwaysAndWhenInUseUsageDescription` (Le Guet), `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription` (avis photos), `NSPhotoLibraryUsageDescription` (sélection photos), `NSUserNotificationsUsageDescription` (rappels Le Guet).
  - Toutes les usage descriptions wordées en français (langue par défaut `fr-CI`, cohérent NFR-I18N-01) et conformes Loi 2013-450 (mention de la finalité unique : usage spawt + découverte). Source : DR-ARTCI-04 + NFR-SEC-02.

- **PTR-STORE-04 — Age rating.** Classification :
  - **Apple :** 17+ — mention occasionnelle d'alcool dans les fiches lieu (Maquis, bars, Bo Zinc) ; UGC modéré (avis, photos) ; localisation continue.
  - **Google Play :** « Mature 17+ » (PEGI 16 équivalent) — mêmes motifs.
  - **Pas de contenu pour < 13 ans** → pas de gestion COPPA/Kids spéciale, pas de mode famille, pas de modération renforcée des comptes mineurs. Source : conformité Loi 2013-450 — collecte PII donc inscription réservée majeurs (à confirmer juridique CGV DR-CGV-01).

---

## Functional Requirements

39 capacités. Chaque FR est traçable au PRD §3.1 (19 features MVP) ou aux annexes §20.x. Le périmètre Sprint 1 (12 features) est indiqué dans le champ Phase ; les amendements team `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §4 sont intégrés comme contraintes des FRs concernés.

### Inscription, identité et calibrage

**FR-001 — Authentification spawter**
*Capability :* Le spawter peut créer son compte ou se reconnecter via numéro de téléphone et OTP en méthode primaire, ou Google Sign-In en méthode secondaire.
*Acceptance :* L'OTP est délivré dans les 30 secondes pour 95% des envois. La session reste active jusqu'à déconnexion explicite ou révocation. Aucune méthode email+password n'est disponible.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 1.

**FR-002 — Onboarding et calibrage initial du Palais**
*Capability :* Le spawter peut compléter en moins de 3 minutes 5 questions de calibrage (une par axe bipolaire : Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table) qui génèrent son Palais initial avec scores entre -40 et +40 par axe. Il saisit également quartier de résidence, type de cuisine préféré, budget habituel, contexte principal (solo/groupe), country_code, origin_country_code, gender, age_range.
*Acceptance :* L'écran final présente le Palais initial et le premier titre attribué. 70% des spawters qui démarrent l'onboarding le complètent. Les champs `country_code`, `origin_country_code`, `gender`, `age_range` sont stockés sur la table `spawters` (amendement team §4.5).
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 2, §20.2 ; cahier §4.5.

**FR-003 — Voix du chat évolutive**
*Capability :* Le spawter reçoit dans l'app des messages personnalisés du chat SPAWT (mascotte) dont le ton dépend de son stade courant : Touriste enjoué/taquin, Explorateur complice, Détective grave, Djidji solennel, Guide silencieux.
*Acceptance :* Le wording est centralisé en strings extractibles i18n. Chaque montée de stade change le ton dans les 24 heures suivantes maximum.
*Phase :* Sprint 1. *Source :* PRD §9.3, §15.5.

### Découverte et exploration

**FR-004 — Feed personnalisé**
*Capability :* Le spawter consulte une liste ordonnée de lieux par score de matching composite calculé selon la formule : `0,15 × similarité_cosinus(Palais, ADN) + 0,30 × pénalité_distance + 0,30 × note_pondérée + 0,10 × bonus_recency + 0,15 × bonus_novelty`. Le score est affiché en pourcentage borné [50%, 99%] via `50 + score × 49`.
*Acceptance :* Le feed retourne au moins 10 lieux pour un spawter situé en zone Abidjan. Le temps de chargement P95 est < 3 secondes sur 3G. Les lieux hors zone géo (>3 km en gratuit) sont affichés mais floutés (FR-014).
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 3, §8.1, §8.3, §20.6.

**FR-005 — Fiche lieu détaillée**
*Capability :* Le spawter consulte la page d'un lieu présentant : photo principale, nom, quartier, type de cuisine, fourchette de prix, note communautaire pondérée, horaires, adresse, bouton Appeler, bouton WhatsApp, score de matching en pourcentage, signaux spéciaux (Pépite Vérifiée, Institution, Coup de Cœur, Fidélité, Découverte, Table Diverse, Noctambule Vérifié), et radar ADN à 5 axes affiché uniquement si le lieu a ≥ 5 avis (sinon mention « ADN en construction »).
*Acceptance :* La fiche s'ouvre en moins de 2 secondes après tap sur le feed. Tous les signaux spéciaux respectent leurs conditions PRD §6.3.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 4, §6.3.

**FR-006 — Le Spawt (Le Guet)**
*Capability :* Le spawter peut enregistrer sa présence dans un lieu via un mécanisme passif type VTC : le système détecte son entrée dans un périmètre de 10 mètres autour du lieu, attend 15 minutes en zone avant de déclencher une notification locale « Comment c'était chez {place_name} ? » (clé i18n `notif.guet.prompt`, interpolation runtime), accepte un snooze de 15 minutes répétable 3 fois maximum, maintient la fenêtre de notation active pendant toute la présence + 30 minutes après la sortie de zone, et enregistre un spawt passif (poids 0,5x) si aucune réponse n'est donnée mais la présence est prouvée.
*Acceptance :* Un spawt simple se complète en moins de 30 secondes. Les règles anti-fraude DR-FRAUD-01 à DR-FRAUD-06 s'appliquent au moment de l'enregistrement. `session_duration_minutes` est calculée en temps réel `now() - checked_in_at` tant que `left_at` est null, snapshot final à la sortie (cahier §4.7). `left_at` = sortie périmètre 10 m détectée OU expiration fenêtre +30 min, selon premier survenu. Le logout applicatif ne termine pas une session check-in en cours.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 5, §7.1, §20.3, §20.4 ; cahier §4.7.

**FR-007 — Avis structuré**
*Capability :* Le spawter peut publier un avis sur un lieu visité incluant une note étoiles 1-5 obligatoire, des tags rapides à sélection multiple parmi 5 valeurs (« Copieux », « Rapide », « Ambiance top », « Cher », « À refaire »), un texte libre optionnel de 500 caractères maximum, et 1 à 3 photos optionnelles compressées à 80% et plafonnées à 1 MB chacune.
*Acceptance :* L'avis est soumis en moins de 2 minutes. Le poids algorithmique appliqué est Touriste 1x, Explorateur 1,5x, Détective 2x, Djidji 2,5x, Guide 3x. L'avis met à jour l'ADN du lieu et le Palais du spawter selon le mapping PRD §20.5 et la formule de décroissance §5.6.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 6, §7.2, §20.5.

### Identité et progression

**FR-008 — Profil spawter**
*Capability :* Le spawter consulte son profil affichant : nom, avatar, quartier, stade actuel, titre actuel et titre affiché (peuvent différer), nombre de spawts, nombre d'avis donnés, lieux sauvegardés, Palais radar à 2 axes en accès gratuit ou 5 axes complets pour les Spawter Gold, collection de titres permanente.
*Acceptance :* Le spawter peut choisir manuellement parmi sa collection le titre affiché (différent du titre actuel calculé automatiquement). L'écran s'ouvre en moins de 1,5 seconde.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 7, §5.4, §5.7.

**FR-009 — Sauvegarde de lieux (Tanière)**
*Capability :* Le spawter peut ajouter ou retirer un lieu de sa liste de favoris depuis la fiche lieu, et consulter sa liste personnelle depuis son profil.
*Acceptance :* L'action prend effet en moins de 500 ms. Le favori est utilisé comme signal de matching dans le calcul du score composite (FR-004).
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 9.

**FR-010 — Progression par stades**
*Capability :* Le spawter progresse automatiquement à travers 5 stades en fonction du nombre de spots uniques avec spawt vérifié : Touriste 0-10, Explorateur 11-20, Détective 21-30, Djidji 31-50, Guide 50+. Un même lieu visité plusieurs fois compte pour 1 spot.
*Acceptance :* À chaque seuil franchi, un écran de célébration s'affiche, un titre est ajouté à la collection permanente, et la voix du chat (FR-003) s'ajuste. Le Guide est limité à 3-5 slots par archétype et par ville. La maturité ne recule jamais.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 8, §5.2, §5.4.

**FR-011 — Coup de Cœur (monnaie sociale rare)**
*Capability :* Le spawter peut décerner un Coup de Cœur à un lieu, avec un quota mensuel indexé sur son stade : 1/mois Touriste/Explorateur/Détective, 2/mois Djidji, 3/mois Guide ; +1 bonus Spawter Gold à tous les stades.
*Acceptance :* Le quota se reset le 1er du mois. Le Coup de Cœur est visible publiquement sur la fiche lieu en V1.5 (Coup de Cœur visible dans la fiche est différé du cahier de Sprint 1). En V1 il est stocké et alimente le badge spécial « Coup de Cœur » du lieu (PRD §6.3).
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 12, §7.3, §18.1 tension 4.

**FR-012 — Système d'archétypes et mues**
*Capability :* Le spawter se voit attribuer automatiquement un archétype parmi les 5 MVP (Pisteur, Bouche d'Or, Gardien du Maquis, Vent d'Ailleurs, Omnivore) dérivé de ses 2 axes Palais dominants. Une mue d'archétype se déclenche uniquement si les axes dominants restent stables sur 30 jours ET 5 spots minimum dans la nouvelle direction.
*Acceptance :* La mue est présentée comme un constat neutre (pas promotion ni rétrogradation), ajoute un titre à la collection, et déclenche une notification du chat. Pas de flip-flop hebdomadaire grâce à la règle d'inertie.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 8, §5.3, §5.5.

### Recherche et navigation

**FR-013 — Recherche et filtres**
*Capability :* Le spawter peut rechercher un lieu par texte (nom, type de cuisine, quartier) et appliquer des filtres combinables : type de cuisine, budget en 3 tranches, distance, note minimale.
*Acceptance :* Les résultats s'affichent en moins de 1,5 seconde sur 3G. Les filtres se combinent en AND.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 10.

**FR-014 — Carte interactive**
*Capability :* Le spawter consulte une vue carte des lieux avec pins, zoom, filtre par catégorie, ouverture de fiche lieu au tap sur pin, bouton de navigation déclenchant un deep link Google Maps ou Waze.
*Acceptance :* La carte utilise un style dark cohérent avec la direction artistique (PRD §15.1). Le paywall géographique (FR-015) y est visuel : lieux hors zone floutés. Le chargement initial de la carte centrée sur Abidjan est < 3 secondes sur 3G.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 11.

**FR-015 — Paywall géographique**
*Capability :* Le spawter en compte gratuit voit les lieux dans un rayon de 3 km autour de son quartier déclaré ; les lieux hors zone sont affichés mais floutés avec mention « PREMIUM — 2 950 F/mois TTC — Tout Abidjan ». Le Spawter Gold accède à tout Abidjan.
*Acceptance :* Le rayon est calculé sur géolocalisation native GPS, vérifié par le backend. Pas de géoloc IP (trop imprecise). Le paywall agit comme nudge, pas comme blocage technique infranchissable (les fiches restent navigables avec contenu masqué).
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 14.

### Communauté et viralité

**FR-016 — Partage WhatsApp**
*Capability :* Le spawter peut partager une fiche lieu sur WhatsApp avec un deep link sortant. Le payload contient : image, nom, note pondérée, lien. Si l'app n'est pas installée chez le destinataire, le deep link redirige vers le store approprié.
*Acceptance :* Le partage s'effectue en moins de 5 secondes. La conversion (download depuis partage WhatsApp → premier spawt) cible 25% (SC-REF-03).
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 16.

**FR-017 — Signalement et modération**
*Capability :* Le spawter peut signaler un avis suspect via un bouton « Signaler » sur l'avis. La modération est manuelle via le panel admin (FR-019), avec workflow : signalement → file d'attente → décision humaine (garder/supprimer/warning/ban).
*Acceptance :* Le signalement est enregistré en moins de 500 ms. La file d'attente admin est consultable triée par ancienneté. Les sanctions disponibles : Warning, BAN selon les Faux-Pas définis (Fake Review, Gatekeeping, Hater Toxique). Source PRD §19 Glossaire Faux-Pas.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 17, §19 Faux-Pas.

**FR-018 — Création modérée de fiche lieu**
*Capability :* Le spawter peut suggérer un lieu absent de la base via un formulaire simple (nom, adresse, type). L'équipe SPAWT valide ou rejette la suggestion. Aucune fiche n'est créée directement par les spawters sans modération.
*Acceptance :* La suggestion est traitée sous 7 jours ouvrés. Le spawter qui a suggéré reçoit une notification de validation/rejet. En V1 les 50-100 lieux initiaux sont pré-chargés par l'équipe terrain (Mission 1 = 20 lieux iconiques).
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 18, §20.8.

### Notifications

**FR-019 — Notifications push et locales**
*Capability :* Le spawter reçoit des notifications de 6 types : (1) Bienvenue à l'inscription, (2) Rappel post-visite Le Guet (locale, déclenchée par geofencing), (3) Nouveau lieu dans la zone (push serveur), (4) Activité sur ton avis (réponse), (5) Montée de stade, (6) Mue d'archétype. Volume plafonné à 3-4 notifications par semaine hors notifications Le Guet (qui sont event-driven).
*Acceptance :* Les notifications Le Guet fonctionnent en mode offline (locales). Les notifications push serveur s'acheminent dans les 30 secondes suivant le trigger en 95e percentile. Le spawter peut configurer ses préférences notification dans Profil → Paramètres.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 13.

### Monétisation

**FR-020 — Souscription Spawter Gold**
*Capability :* Le spawter peut souscrire à Spawter Gold pour 2 500 FCFA HT/mois (2 950 F TTC) ou 25 000 FCFA HT/an (29 500 F TTC, 2 mois offerts). Le paiement s'effectue via Mobile Money agrégé par CinetPay (Orange Money P0, Wave P0, MTN MoMo P1).
*Acceptance :* La souscription est active immédiatement après confirmation paiement CinetPay. Les avantages Gold sont débloqués sans délai : tout Abidjan (FR-015), Palais radar 5 axes (FR-008), avis détaillés, +1 Coup de Cœur, badge doré profil, listes curatées illimitées, analytics personnel Palais dans le temps.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 15, §11.2.

**FR-021 — Gestion d'abonnement avec grace period**
*Capability :* Le spawter reçoit un rappel pré-échéance (J-3) par push + SMS, un rappel jour J (push avec deep link de paiement pré-rempli), puis bénéficie d'une grace period de 7 jours avec bandeau « Ton Gold expire. Renouvelle. ». À J+8 sans paiement, downgrade automatique vers gratuit. Les données premium sont conservées 90 jours masquées et restaurées immédiatement en cas de re-souscription.
*Acceptance :* Aucun prélèvement automatique (impossible en Mobile Money). Le deep link de renouvellement est pré-rempli au plan exact du spawter. La conservation 90 jours respecte la conformité Loi 2013-450 sur les données.
*Phase :* Sprint 2. *Source :* PRD §3.1 Feature 15, §11.4, §14.2.

**FR-022 — Émission de facture conforme**
*Capability :* Le spawter Gold reçoit une facture séquentielle au format `SPAWT-2026-NNNN` par email et SMS dans les 30 secondes suivant le paiement confirmé.
*Acceptance :* Toutes les factures sont stockées dans la table `invoices` avec calcul TVA 18% (price_ht + tva_amount = price_ttc). Numérotation strictement séquentielle. Format URL PDF stockée dans `invoices.pdf_url`.
*Phase :* Sprint 2. *Source :* PRD §13.8, §20.7.

### Administration

**FR-023 — Panel admin web**
*Capability :* Un membre de la table `spawt_staff` peut, via un panel admin web : créer/lire/modifier/supprimer des lieux et leurs métadonnées, modérer les avis (file d'attente de signalements avec actions garder/supprimer/warning/ban), gérer les comptes spawter (ban, warning), consulter les métriques basiques (nombre de spawters, spawts/jour, avis/jour).
*Acceptance :* Le panel est accessible uniquement aux membres `spawt_staff` (séparation team §4.1). L'authentification utilise des credentials distincts de ceux des spawters publics. Les actions critiques (ban) sont auditées avec horodatage et auteur.
*Phase :* Sprint 1. *Source :* PRD §3.1 Feature 19 ; cahier §4.1.

### Data layer et signaux

**FR-024 — Collecte de signaux append-only**
*Capability :* Le système capture en table `user_signals` append-only chaque action significative du spawter : spawt, review, view, save, share, search, filter, click, dismiss. Chaque enregistrement contient `user_id`, `signal_type`, `place_id`, `metadata` (payload JSON structuré : heure, jour, position, device, session_id), `created_at`.
*Acceptance :* Aucune mutation des enregistrements existants (append-only strict). Politique de rétention infinie en V1 (coût stockage négligeable). Index sur `(user_id, created_at)` et `signal_type`.
*Phase :* Sprint 1. *Source :* PRD §3.1, §13.3 ; cahier §4.6.

**FR-025 — Mise à jour du Palais par décroissance exponentielle**
*Capability :* À chaque spawt avec avis, le Palais du spawter se met à jour selon la formule `facteur_apprentissage = max(0,05, 1,0 / (1 + n_spots × 0,05))`, `delta = signal × facteur_apprentissage`, `nouveau_score = clamp(ancien_score + delta, -100, +100)`. Les signaux suivent le mapping PRD §20.5 (13 entrées signal → axe → direction → poids).
*Acceptance :* Recalcul incrémental à chaque spawt (pas from scratch). Stockage des `dominant_axes` en structure JSON sur `user_palais` pour éviter le recalcul à chaque affichage. `confidence_score` recalculé en fonction du nombre de spots. Politique overwrite (cahier §4.6).
*Phase :* Sprint 1. *Source :* PRD §13.1, §5.6, §20.5 ; cahier §4.6.

**FR-026 — Mise à jour de l'ADN du Lieu**
*Capability :* À chaque avis publié sur un lieu, l'ADN du lieu se met à jour à partir des sous-critères de l'avis (cuisine, ambiance, service, rapport qualité-prix) et des tags rapides, mappés vers les 5 axes de l'ADN. Les avis fondateurs marqués `is_seed = true` (FR-032 cold start) **alimentent l'ADN** mais sont **exclus du compteur public** d'avis communauté affiché sur la fiche lieu (FR-005).
*Acceptance :* Un lieu avec < 5 avis (avis seed inclus pour le calcul ADN, exclus pour l'affichage du compteur communauté) affiche « ADN en construction » au lieu d'un radar non fiable. Le `confidence_score` (0 à 1) reflète la fiabilité en fonction du nombre total d'avis (seed + communauté). Les check-ins simples (sans avis) ne modifient pas l'ADN.
*Phase :* Sprint 1. *Source :* PRD §13.2, §6.2 ; cahier §5.4 amendement Claude — **accepté V1** suite à remédiation v1.0.2.

### Séparation entités (amendements team §4)

**FR-027 — Séparation `spawters` / `spawt_staff`**
*Capability :* L'application sépare les comptes publics B2C (`spawters`) des comptes équipe interne (`spawt_staff`, modérateurs, allies terrain, admin panel). Les comptes `spawt_staff` ne peuvent pas spawter, et n'apparaissent pas dans la communauté publique.
*Acceptance :* Toutes les FK des tables `user_palais`, `spawter_progression`, `collection_titres`, `mue_tracking`, `spawt_checkin`, `user_signals` pointent vers `spawters(id)`, jamais vers une table `users` générique. Les accès admin (FR-023) sont restreints à `spawt_staff`.
*Phase :* Sprint 1. *Source :* Cahier §4.1.

**FR-028 — Table commerciale `customers`**
*Capability :* L'entité applicative (`spawters`) est séparée de l'entité commerciale (`customers`). Un spawter B2C peut avoir 0 ou 1 customer, créé uniquement au moment de l'upgrade Spawter Gold. En V1.5 B2B, un customer peut être lié à un `place` (Pro / Gold).
*Acceptance :* `subscriptions.customer_id` et `invoices.customer_id` pointent vers `customers.id`. Le champ `customer_type` (`b2c`/`b2b`) migre de `subscriptions` vers `customers`. Les jointures pour récupérer l'identité publique d'un customer passent par `customers.spawter_id → spawters.id`.
*Phase :* Sprint 1 (B2C uniquement, V1.5 pour B2B). *Source :* Cahier §4.2.

**FR-029 — Catalogue de plans tarifaires**
*Capability :* L'application gère les plans tarifaires via une table dédiée `plans` (champs `code`, `label`, `price_ht`, `currency_id`, `country_code`, `period`, `is_active`). Le champ `subscriptions.plan_id` référence cette table à la place d'un enum.
*Acceptance :* Sprint 1 seed = `gold_monthly`, `gold_annual` (CI/XOF). V1.5 ajoute `pro` et `b2b_gold`. Un plan Gold peut être facturé différemment selon `country_code` (préparation Lagos/Dakar).
*Phase :* Sprint 1. *Source :* Cahier §4.3.

**FR-030 — Catalogue de devises multi-pays**
*Capability :* L'application gère les devises via une table `currencies` (champs `code` ISO 4217, `label`, `base_rate`, `modifier`, `country_code`, `is_active`). Sprint 1 seed = XOF actif, autres devises présentes mais inactives.
*Acceptance :* Les hooks de conversion sont implémentés mais inactifs en V1. L'affichage des prix utilise la devise active du pays courant.
*Phase :* Sprint 1. *Source :* Cahier §4.4.

### Direction artistique et tokens

**FR-031 — Système de tokens design**
*Capability :* Toutes les couleurs, typographies et espacements du produit sont définis dans un fichier de tokens **source unique de vérité**, exporté en CSS variables et en JSON pour Figma. Aucune valeur de couleur n'est codée en dur dans les composants. (Localisation du fichier dans la base de code : voir Annexes §15.6.)
*Acceptance :* La palette **canonique** (source de vérité brand : `documentation/ux/spawt-tokens.css`, kit `documentation/ux/` — prime sur le `.docx` §15) est respectée : Noir #0A0A0A, Or SPAWT #C8A44E, Or clair #E8D5A0, Vert Chat #2D6B4F, Vert Chat foncé #1F4D39, Blanc cassé #FAFAF8, Ambre #E89A39, Crème sable #EFE8DC, Blanc pur #FFFFFF, Graphite #333333, Gris moyen #8A8A8A. Le token `--alert-red` (états erreur, badge « trending ») reste **à définir** — revue Alexandre (brand) + Stéphanie (contraste WCAG), cf. UX-DR2. Les typographies utilisent Klinsman (display — titres, noms, voix du Chat) et Gotham (body — corps, data, overlines), fichiers dans `documentation/ux/fonts/`. Le mode sombre est préparé dans l'architecture tokens mais inactif en V1.
*Phase :* Sprint 1 (Phase 0). *Source :* PRD §12.2, §15.1, §15.2, §15.3, §15.6 (références au `.docx` source ; valeurs réalignées sur le kit canonique `documentation/ux/` — erratum v1.0.3).

### Carte et inventaire

**FR-032 — Pré-chargement de l'inventaire initial + avis fondateurs**
*Capability :* Au lancement public, l'équipe SPAWT a pré-chargé 50 à 100 lieux dans la base, dont 20 lieux onboardés en Mission 1 par les Allies terrain : 5 Date night/Premium, 5 Dabali/Racines clean, 3 Boys/Barbecue, 3 Nouveaux restaurants, 2 Hype/Instagram, 2 Sceptiques. Chaque lieu pré-chargé reçoit **3 avis fondateurs** (`is_seed = true`) produits par les Allies terrain / équipe SPAWT, totalisant 150-300 avis seed au lancement.
*Acceptance :* Aucun spawter n'arrive sur une carte vide. Chaque lieu pré-chargé dispose des métadonnées minimales : photo, nom, quartier, type cuisine, fourchette prix, horaires, adresse, géoloc. Les avis seed alimentent l'ADN du lieu (FR-026) dès J0 pour éviter les radars « ADN en construction » massifs, **sans gonfler artificiellement le compteur public** (filtre `is_seed = false` à l'affichage). Le champ `is_seed BOOLEAN DEFAULT false` est ajouté à `spawt_checkin` (ou table dédiée `seed_reviews` selon décision tech lead). Le panel admin (FR-023) distingue visuellement « avis fondateur » vs « avis communauté ».
*Phase :* Sprint 1 Phase 4 (lieux), Sprint 1 Phase 0-4 (avis seed étalés). *Source :* PRD §17.1, §20.8, §14.3 ; cahier §5.4 amendement Claude — **accepté V1** suite à remédiation v1.0.2.

### Suppression / export (conformité ARTCI)

**FR-033 — Suppression de compte et export self-service**
*Capability :* Le spawter peut depuis Profil → Paramètres demander la suppression de son compte (soft-delete sur `spawters`, anonymisation après 30 jours) et exporter ses données personnelles en JSON téléchargeable.
*Acceptance :* La soft-delete masque immédiatement le compte de la communauté. L'anonymisation à J+30 efface définitivement les champs PII (téléphone, nom, gender, age_range) tout en conservant les signaux agrégés anonymes pour le ML. L'export inclut profil, Palais, collection titres, spawts, avis.
*Phase :* Sprint 2. *Source :* PRD §20.7 ; cahier §5.2 (amendement Claude `[pending]` mais besoin imposé par Loi 2013-450).

### Sanctions communautaires

**FR-034 — Application des sanctions Faux-Pas**
*Capability :* Un membre `spawt_staff` peut appliquer trois niveaux de sanctions selon les Faux-Pas définis : Warning puis BAN sur Fake Review (review sponsorisée non déclarée, vengeance), Avertissement sur Gatekeeping (refus partage, fausses infos), BAN définitif sur Hater Toxique (reviews méchantes gratuites, trolling).
*Acceptance :* Toute sanction est tracée dans une table d'audit avec auteur `spawt_staff_id`, date, motif, état précédent. Un spawter banné perd l'accès en lecture et écriture immédiatement.
*Phase :* Sprint 2. *Source :* PRD §19 Faux-Pas.

### Badges et signaux spéciaux

**FR-035 — Badge `Premier Spawt` (verrou activation)**
*Capability :* Le spawter qui complète son premier spawt vérifié obtient le badge `Premier Spawt`. Avant ce badge, l'accès aux avis détaillés des autres spawters est verrouillé.
*Acceptance :* Le badge est attribué en moins de 5 secondes après confirmation du premier spawt. Le verrou se lève immédiatement.
*Phase :* Sprint 1. *Source :* Cahier §3.2 ; PRD §10.3 (fonction ACTIVER).

**FR-036 — Badges spéciaux du lieu**
*Capability :* Chaque lieu se voit attribuer automatiquement des badges selon les conditions PRD §6.3 : Coup de Cœur (X Coups de Cœur ce mois), Pépite Vérifiée (3+ Djidji/Guide ont confirmé), Institution (note ≥ 4,5 stable +12 mois et 50+ avis), Fidélité (taux de retour spawters >30%), Découverte (0→20 spawts en 30 jours), Table Diverse (5+ archétypes différents), Noctambule Vérifié (ouvert tard confirmé par 10+ spawters).
*Acceptance :* Les badges sont calculés par job batch quotidien. Affichage sur la fiche lieu (FR-005) avec icone et tooltip.
*Phase :* Sprint 2. *Source :* PRD §6.3.

**FR-037 — Note communautaire pondérée**
*Capability :* La note affichée d'un lieu est pondérée par le stade du votant : `note_affichée = Σ(note × poids_stade) / Σ(poids_stade)` avec poids Touriste 1x, Explorateur 1,5x, Détective 2x, Djidji 2,5x, Guide 3x.
*Acceptance :* La note pondérée se recalcule incrémentalement à chaque nouvel avis. Affichage en étoiles 1-5 sur la fiche lieu et le feed.
*Phase :* Sprint 1. *Source :* PRD §7.2, §3.1 Feature 6, §8.2.

### Interface paiement abstraite

**FR-038 — Interface de paiement abstraite**
*Capability :* L'application abstrait le provider de paiement derrière une interface `IPaymentProvider` exposant : `initiate(params)`, `getStatus(transactionId)`, `confirm(transactionId)`, `refund(params)`, `parseWebhook(payload)`. CinetPay est l'implémentation V1, remplaçable sans refactoring majeur.
*Acceptance :* L'ajout d'un provider alternatif (ex. Flutterwave) ne requiert aucune modification dans le code applicatif consommateur de l'interface. Un test d'intégration valide le swap CinetPay → mock provider.
*Phase :* Sprint 2. *Source :* PRD §12.3, §14.4 (ARBITRAGE FONDATEUR).

### Mode offline et résilience

**FR-039 — Stockage local des spawts en attente de synchronisation**
*Capability :* En cas de perte de connectivité 3G/4G, les spawts détectés par Le Guet sont enregistrés localement sur le device et synchronisés automatiquement avec le backend dès le retour du réseau.
*Acceptance :* Aucune perte de spawt en cas de coupure réseau ponctuelle (< 24h). La file de synchronisation est inspectable et purgeable par le spawter depuis Profil → Paramètres. Mode offline complet est prévu Phase 2 (V2).
*Phase :* Sprint 1. *Source :* PRD §14.1.

### Consent ARTCI explicite (amendement Claude §5.2)

**FR-040 — Écran de consentement ARTCI à l'onboarding**
*Capability :* Avant la première question de calibrage Palais (FR-002), le spawter passe par un écran de consentement explicite couvrant : (1) collecte de la géolocalisation continue pour Le Guet (FR-006), (2) collecte des PII `gender` / `age_range` / `origin_country_code` / `country_code` (FR-002 onboarding), (3) lien vers la politique de confidentialité, (4) lien vers les CGU/CGV (DR-CGV-01). L'écran présente 2 cases à cocher non pré-cochées : « J'accepte les CGU/CGV » et « J'accepte la collecte de mes données et de ma géolocalisation pour le service SPAWT (usage spawt uniquement) ». Bouton « Continuer » désactivé tant que les 2 cases ne sont pas cochées.
*Acceptance :* Le consentement est historisé sur `spawters.cgv_accepted_at` et `spawters.geoloc_consent_at` (timestamps distincts pour granularité audit ARTCI). Le spawter peut révoquer le consent géoloc à tout moment depuis Profil → Paramètres → Vie privée (bascule Le Guet en mode désactivé, conserve le compte). La révocation des CGU = déclenchement du flow FR-033 (suppression compte). Le wording de l'écran est validé par juriste (DR-CGV-01) avant le lancement public. La langue est `fr-CI` (NFR-I18N-01).
*Phase :* Sprint 1 (bloquant — sans cela, infraction Loi 2013-450 dès le J0). *Source :* PRD §20.7 ; cahier §5.2 amendement Claude — **accepté V1** suite à remédiation v1.0.2 ; DR-ARTCI-02, DR-ARTCI-03, DR-ARTCI-04 ; DR-CGV-01.

### Feature flags système (amendement Claude §5.5)

**FR-041 — Système de feature flags**
*Capability :* L'application expose un système de feature flags permettant d'activer/désactiver les 12 features Sprint 1 (et les 7 reportées Sprint 2) au runtime, par scope (`internal` / `alpha` / `beta` / `prod`), avec possibilité de cibler des spawters spécifiques. Table `feature_flags(flag_code, spawter_id NULL, enabled, scope, expires_at NULL)`. Hook React Native `useFlag(code)` consommé par les composants gating.
*Acceptance :* Aucune branche de feature longue durée nécessaire — chaque feature merge dès complétion derrière un flag désactivé en `prod`. L'ouverture progressive `internal` → `alpha` → `beta` → `prod` est gérée depuis le panel admin (FR-023). Les `spawt_staff` peuvent activer un flag pour un spawter spécifique (ex : alpha §5.8). La désactivation d'un flag est immédiate (TTL < 60s côté client, polling). Pas de feature flag sur les FR data-layer (FR-024 à FR-030) ni sur les NFR (toujours actifs).
*Phase :* Sprint 1 Phase 0 (livré avant la première feature). *Source :* cahier §5.5 amendement Claude — **accepté V1** suite à remédiation v1.0.2.

---

## Non-Functional Requirements

Template appliqué : `The system shall [metric] [condition] [measurement method]`. Sources : PRD §12 stack technique, §14 contraintes et risques, §16 KPIs, §20.4 anti-fraude, §20.7 conformité.

### Performance — temps de réponse

- **NFR-PERF-01 :** The system shall serve the personalized feed (FR-004) in under 3 seconds for the 95th percentile on 3G connectivity, as measured by Sentry performance monitoring on Android mid-range devices. Source PRD §14.1, §16.1.
- **NFR-PERF-02 :** The system shall open a place detail (FR-005) in under 2 seconds for the 95th percentile on 3G, as measured by Sentry performance monitoring. Source PRD §3.1 Feature 4 implied by §16.1 session duration constraints.
- **NFR-PERF-03 :** The system shall persist a spawt (FR-006) in under 500 ms for the 95th percentile from confirm action to backend acknowledgement, as measured by API trace logging. Source PRD §7.1 (duration target <30s for full spawt) — implied envelope.
- **NFR-PERF-04 :** The system shall deliver Le Guet notification (FR-006, FR-019) within 30 seconds of geofencing trigger when device has network, as measured by event timestamp diff in `user_signals`. Source PRD §3.1 Feature 13.

### Performance — taille et bundle

- **NFR-PERF-05 :** The system shall ship an installed APK size under 50 MB on Android, as measured by Google Play Console. Source PRD §14.1.
- **NFR-PERF-06 :** The system shall load an initial JavaScript bundle under 500 KB gzipped on first launch, as measured by Expo Updates build report. Source PRD §12.1 implied for low-end Android.
- **NFR-PERF-07 :** The system shall compress user-uploaded photos (FR-007) to 80% quality and 1 MB maximum per image, as measured server-side post-upload by Cloudinary metadata. Source PRD §12.1.

### Géolocalisation

- **NFR-GEO-01 :** The system shall use a 10-meter detection perimeter for Le Guet trigger (FR-006), as configured in geofencing native APIs. Source PRD §7.1, §20.4.
- **NFR-GEO-02 :** The system shall require GPS accuracy under 30 meters before validating a spawt as verified; if accuracy is worse, the spawt falls back to manual mode, as measured by `spawt_checkin.accuracy_meters`. Source PRD §14.1.
- **NFR-GEO-03 :** The system shall average the last 3 GPS positions over 30 seconds before triggering Le Guet, as measured by client-side telemetry. Source PRD §14.1.
- **NFR-GEO-04 :** The system shall disable GPS monitoring and switch to manual spawt mode when device battery drops under 10%, as measured by OS battery API. Source PRD §14.1.

### Disponibilité et résilience

- **NFR-AVAIL-01 :** The system shall maintain 99.9% uptime for the public backend during business hours (08:00-22:00 GMT) as measured by Supabase free tier SLA + custom heartbeat. Source PRD §12.1 implied.
- **NFR-AVAIL-02 :** The system shall queue spawts locally when offline and synchronize within 60 seconds of network restoration, as measured by `user_signals.created_at` versus `spawt_checkin.created_at`. Source PRD §14.1 ; FR-039.
- **NFR-AVAIL-03 :** The system shall tolerate aggressive Android OEM background termination (Tecno, Infinix, Samsung) by persisting geofences at OS level with maximum 5-minute latency to wake the app, as measured by manual QA on the device matrix. Source PRD §14.1.

### Conformité et sécurité

- **NFR-SEC-01 :** The system shall enforce Row Level Security (RLS) on all Supabase tables containing spawter PII (`spawters`, `user_palais`, `spawter_progression`, `collection_titres`, `mue_tracking`, `spawt_checkin`, `user_signals`, `customers`, `subscriptions`, `invoices`), as audited by Supabase advisor checks. Source PRD §12.1 implied by §20.7.
- **NFR-SEC-02 :** The system shall require explicit user consent before activating geolocation tracking, as evidenced by a stored consent timestamp on `spawters` and a blocking onboarding screen. Source PRD §20.7 ; DR-ARTCI-04.
- **NFR-SEC-03 :** The system shall transmit all client-server communications over TLS 1.2 or higher, as configured at the Supabase HTTPS gateway. Source PRD §20.7 implied by Loi 2013-450 stockage sécurisé.
- **NFR-SEC-04 :** The system shall soft-delete a spawter account within 5 seconds of user request and anonymize PII fields within 30 days, as enforced by a scheduled job on `spawters.deletion_requested_at`. Source PRD §20.7 ; DR-ARTCI-05 ; FR-033.

### Anti-fraude (techniques, distinct de modération humaine)

- **NFR-FRAUD-01 :** The system shall reject spawts on the same place within 4 hours of a verified spawt, as enforced by SQL trigger on `spawt_checkin` insert. Source PRD §20.4 ; DR-FRAUD-01.
- **NFR-FRAUD-02 :** The system shall flag any spawter accumulating more than 5 spawts per day, as enforced by SQL trigger setting `flag_reason` on `spawt_checkin`. Source PRD §20.4 ; DR-FRAUD-02.
- **NFR-FRAUD-03 :** The system shall flag any spawt sequence implying displacement velocity > 100 km/h between two consecutive verified spawts, as enforced by SQL trigger. Source PRD §20.4 ; DR-FRAUD-03.
- **NFR-FRAUD-04 :** The system shall assign weight 0.5x to any spawt with `is_verified = false`, as enforced by aggregation logic on ADN and Palais updates. Source PRD §20.4 ; DR-FRAUD-04.
- **NFR-FRAUD-05 :** The system shall flag the spawter account when 10+ identical spawt patterns are detected within a rolling 7-day window, as enforced by daily batch analysis. Source PRD §20.4 ; DR-FRAUD-05.
- **NFR-FRAUD-06 :** The system shall flag any spawt with `left_at - arrived_at < 5 minutes` AND `check_in_type = 'active'`, as enforced by SQL trigger at session close. Source PRD §20.4 ; DR-FRAUD-06.

### Observabilité

- **NFR-OBS-01 :** The system shall report a crash-free session rate above 99% as measured by Sentry on rolling 7-day window. Source PRD §12.1, §14.4.
- **NFR-OBS-02 :** The system shall collect AARRR funnel events (acquisition, activation, retention, referral, revenue) in Mixpanel or PostHog with cohort tracking enabled. Source PRD §12.1, §16.1.
- **NFR-OBS-03 :** The system shall capture all 9 user signal types (spawt, review, view, save, share, search, filter, click, dismiss) in `user_signals` append-only table, as audited by SQL count on signal_type enum coverage. Source PRD §8.4, §13.3 ; FR-024.
- **NFR-OBS-04 :** The system shall use the analytics taxonomy defined in `documentation/analytics/events.md` (curated by Kidam pre-Sprint 1) as the **single source of truth** for event names, properties, and snake_case conventions. No ad-hoc event SHALL be emitted from code without prior addition to `events.md` (audit via PR review checklist). Event identifiers SHALL match the `EVT-XX` references used in dev tickets. Source cahier §5.1 amendement Claude — **accepté V1** suite à remédiation v1.0.2.

### Internationalisation

- **NFR-I18N-01 :** The system shall extract 100% of user-facing strings to a localization layer (i18next + `app/src/i18n/fr.json`) with default locale `fr-CI`, as enforced by a build-pipeline audit (`npm run i18n:check`) that fails the build on any hardcoded FR string outside the localization layer. Source cahier §5.6 amendement Claude — **accepté V1 (Sprint 1 Phase 0)** suite à remédiation v1.0.2.
- **NFR-I18N-02 :** The system shall enforce a vocabulary audit (`npm run lint:vocab`) blocking the build on any out-of-glossary term (`user`, `restaurant`, `check-in`, `like`, `points`, `level`, `score`, `leaderboard`, `ranking`, etc.) in `app/src/**` and `app/app/**`, as scoped by `app/scripts/lint-vocab.mjs`. Source cahier §5.6 bonus brand (Alexandre) ; project-context.md vocab table.

### Architecture portable (multi-villes)

- **NFR-PORT-01 :** The system shall support adding a new city (e.g. Dakar) without code refactoring, as enforced by the `country_code` column on `spawters`, `places`, `plans`, `currencies`. A spawter shall be able to be Guide in one city and Touriste in another. Source PRD §18.1 tension 5, §11.5 ; cahier §4.3, §4.4, §4.5.

### Capacité et charge

- **NFR-CAP-01 :** The system shall support 15 000 monthly active users (MAU target M12) with response times within NFR-PERF-01 to NFR-PERF-04 bounds, as measured by load testing on Supabase managed PostgreSQL. Source PRD §16.3.
- **NFR-CAP-02 :** The system shall accommodate 500 spawts per day and 200 reviews per day at M12 without degradation, as measured by Supabase query metrics. Source PRD §16.3.
- **NFR-CAP-03 :** The system shall serve up to 800 places in the inventory with sub-second feed queries at M12, as measured by Supabase query EXPLAIN ANALYZE on the score composite materialized view. Source PRD §16.3, §8.1.

### Coûts opérationnels

- **NFR-COST-01 :** The system shall cap monthly Mapbox API costs under a project-defined threshold via aggressive tile caching and rate limiting, as monitored by Mapbox dashboard alerting. Source PRD §14.4.
- **NFR-COST-02 :** The system shall minimize Cloudinary storage costs by compressing photos to 1 MB max (NFR-PERF-07) and applying lazy loading on lists, as measured by Cloudinary cost dashboard. Source PRD §12.1.

### Conservation et migration data

- **NFR-DATA-01 :** The system shall retain `user_signals` append-only with no row mutations, as enforced by Postgres trigger preventing UPDATE/DELETE, to preserve ML training material for V2. Source PRD §13.3, §8.4 ; FR-024.
- **NFR-DATA-02 :** The system shall conserve premium subscription data for 90 days after downgrade in a masked state, as enforced by retention policy on `subscriptions.expires_at` + 90 days mask flag. Source PRD §11.4.
- **NFR-DATA-03 :** The system shall apply overwrite policy on `user_palais` and `spawter_progression` updates, retaining historical trajectory exclusively via append-only `collection_titres` and `user_signals` tables. Source cahier §4.6.

### Paiement Mobile Money

- **NFR-PAY-01 :** The system shall confirm a CinetPay-initiated payment within 60 seconds for 95% of transactions, as measured by `invoices.paid_at - invoices.issued_at`. Source PRD §11.4, §12.1.
- **NFR-PAY-02 :** The system shall fall back to a backup payment provider (e.g. Flutterwave) without code refactoring through the `IPaymentProvider` interface (FR-038), as validated by integration tests. Source PRD §12.3, §14.4.

---

## Annexes — Traçabilité

### Mapping FR/NFR ↔ section PRD source

> **Convention des références `§`** : tous les renvois `§<numéro>` dans les champs *Source* et les critères d'*Acceptance* des FR/NFR pointent vers le **PRD source `documentation/SPAWT_PRD_V1.docx`** (John BMad, 2026-04-09) — **pas** vers des titres de ce `PRD.md` restructuré. Ce `PRD.md` n'a pas de section « §15 » : les renvois `§15.x` désignent la direction artistique du `.docx` source (réalignée sur le kit canonique `documentation/ux/` — voir erratum v1.0.3 et FR-031).

- **Inscription/Identité (FR-001 à FR-003)** : PRD §3.1 Features 1-2, §9.3, §15.5, §20.2 ; cahier §4.5.
- **Découverte (FR-004 à FR-007)** : PRD §3.1 Features 3-6, §6.3, §7.1, §7.2, §8.1, §8.3, §20.3, §20.4, §20.5, §20.6 ; cahier §4.7.
- **Identité spawter (FR-008 à FR-012)** : PRD §3.1 Features 7, 8, 9, 12 ; PRD §5.2, §5.3, §5.4, §5.5, §5.7, §7.3, §10.3, §18.1 tension 4.
- **Recherche/Navigation (FR-013 à FR-015)** : PRD §3.1 Features 10, 11, 14.
- **Communauté (FR-016 à FR-018)** : PRD §3.1 Features 16, 17, 18 ; PRD §19 Faux-Pas ; PRD §20.8.
- **Notifications (FR-019)** : PRD §3.1 Feature 13.
- **Monétisation (FR-020 à FR-022)** : PRD §3.1 Feature 15 ; PRD §11.2, §11.4, §13.8, §14.2, §20.7 ; **Journey 5** (parcours user-side ajouté V1.0.1).
- **Administration (FR-023)** : PRD §3.1 Feature 19 ; cahier §4.1.
- **Data layer (FR-024 à FR-026)** : PRD §13.1, §13.2, §13.3, §5.6, §6.2, §20.5 ; cahier §4.6.
- **Séparation entités (FR-027 à FR-030)** : Cahier §4.1, §4.2, §4.3, §4.4.
- **Direction artistique (FR-031)** : PRD §12.2, §15.1, §15.2, §15.3, §15.6.
- **Inventaire (FR-032)** : PRD §17.1, §20.8, §14.3.
- **Conformité (FR-033)** : PRD §20.7 ; cahier §5.2 (statut `[pending]` mais besoin imposé Loi 2013-450).
- **Sanctions (FR-034)** : PRD §19 Faux-Pas.
- **Badges (FR-035 à FR-037)** : PRD §10.3 ACTIVER, §6.3, §7.2, §8.2 ; cahier §3.2.
- **Paiement abstrait (FR-038)** : PRD §12.3, §14.4.
- **Résilience (FR-039)** : PRD §14.1.
- **Consent ARTCI (FR-040)** : Cahier §5.2 amendement Claude — accepté v1.0.2. PRD §20.7 ; DR-ARTCI-02, 03, 04 ; DR-CGV-01.
- **Feature flags (FR-041)** : Cahier §5.5 amendement Claude — accepté v1.0.2.
- **Events taxonomy (NFR-OBS-04)** : Cahier §5.1 amendement Claude — accepté v1.0.2. Source `documentation/analytics/events.md` (Kidam).
- **i18n + vocab audit (NFR-I18N-01, NFR-I18N-02)** : Cahier §5.6 amendement Claude — accepté v1.0.2. Bonus lint vocab (Alexandre).
- **Store compliance (PTR-STORE-01 à 04)** : Apple App Store Review Guidelines §3.1.1, §4.0, §5.1.1, §1.2 ; Google Play Console Policies (Data Safety, Background Location, target API 34) ; Loi 2013-450 (consent permissions). Ajouté V1.0.1.
- **CGU/CGV (DR-CGV-01 à 07)** : Étendu v1.0.2 — checklist juriste 7 sous-DRs `[pending juriste]` couvrant droit applicable, rétractation, résiliation Gold, remboursement Mobile Money, PI UGC, modération, juridiction.

### Disposition des amendements Claude §5.x (cahier Sprint 1)

Statut traité en remédiation v1.0.2. Chaque amendement reçoit une **disposition Validation Architect** (recommandation) + **action concrète appliquée au PRD**. La validation finale reste soumise au triple sign-off (Stéphanie + Kidam + Alexandre).

| § | Amendement Claude | Disposition VA | Couverture PRD post-v1.0.2 |
|---|---|---|---|
| **§5.1** | Taxonomie events.md figée avant code | ✅ **Accepté V1** | **NFR-OBS-04** (events.md = single source of truth, EVT-XX référencés). `events.md` listé dans frontmatter `inputDocuments` du PRD. |
| **§5.2** | Conformité ARTCI / Loi 2013-450 dès Sprint 1 (consent screen + suppression + export) | ✅ **Accepté V1** | **FR-040** (écran consent ARTCI à l'onboarding, bloquant) + **FR-033** (suppression/export, déjà intégré v1.0). DR-ARTCI-01 à 05 inchangés. |
| **§5.3** | Anti-fraude L1 dans Feature 5 (pas attendre Feature 17) | ✅ **Déjà accepté V1** | DR-FRAUD-01 à 06 + NFR-FRAUD-01 à 06 (6 SQL triggers + colonnes `flag_reason`) intégrés depuis v1.0. Aucune modification requise. |
| **§5.4** | Cold start qualitatif — 3 avis fondateurs par lieu (`is_seed`) | ✅ **Accepté V1** | **FR-032** amendé (150-300 avis seed = 50-100 lieux × 3) + **FR-026** amendé (avis seed alimentent ADN mais exclus compteur public). Champ `is_seed BOOLEAN DEFAULT false` à ajouter sur `spawt_checkin`. |
| **§5.5** | Feature flags système dès Phase 0 | ✅ **Accepté V1** | **FR-041** (table `feature_flags` + hook `useFlag`, 4 scopes internal/alpha/beta/prod). Bloque l'ouverture progressive sans long-lived branches. |
| **§5.6** | i18n strings extraites dès Sprint 1 + lint vocab | ✅ **Accepté V1** | **NFR-I18N-01** promu de partial → full (100% strings, build-pipeline audit) + **NFR-I18N-02** ajouté (lint:vocab bloquant). Cohérent project-context.md. |
| **§5.7** | Performance budget chiffré + matrice 4 devices | ✅ **Déjà accepté V1** | NFR-PERF-01 à 07 (P95 feed <3s 3G, bundle <500KB, APK <50MB) + NFR-AVAIL-03 (OEM Android 5min latency) + PTR-DEV-01 à 04 (matrice devices) intégrés depuis v1.0. Document `documentation/qa/device_matrix.md` à créer Phase 0 — référencé project-context.md mais hors PRD scope (process). |
| **§5.8** | Alpha interne 5 spawters fin Sprint 1 | ✅ **Accepté V1 (process, hors FR/NFR)** | Process opérationnel — pas un product requirement. Géré par FR-041 (feature flags scope `internal`) qui rend l'alpha techniquement faisable. **Acceptance criterion** ajouté à FR-006 (Le Guet) : « validation alpha 5 spawters × 1 semaine avant ouverture beta » (à amender en v1.0.3 ou laisser au cahier Sprint 1 §5.8 sans le rapatrier dans le PRD — décision tech lead). Position actuelle : laissé dans le cahier comme « definition of done Sprint 1 ». |

**Synthèse :** 8/8 amendements **dispositionnés**. 6 sont **traduits en FR/NFR** dans le PRD v1.0.2 (FR-040, FR-041, NFR-OBS-04, NFR-I18N-01 promu, NFR-I18N-02, FR-032/FR-026 amendés). 2 étaient **déjà couverts** par le PRD v1.0 (§5.3 anti-fraude, §5.7 perf budget). 1 reste comme **process** dans le cahier (§5.8 alpha — pas un requirement produit).

**Sign-off requis pour basculer `[pending]` → accepté formel :** Stéphanie (tech/qa) + Kidam (analytics/KPI) + Alexandre (brand/vocab/copy). En attente d'une session de revue commune.

### Localisation des artefacts dans la base de code (référence FR-031)

Pour traçabilité agent IA / dev (cohérent avec `_bmad-output/project-context.md`) :

- **Tokens design (FR-031)** : `app/src/theme/tokens.ts` — source unique de vérité **côté code** pour palette + typographies + espacements. Export CSS variables + JSON Figma. **Source brand canonique : `documentation/ux/spawt-tokens.css`** (kit `documentation/ux/`, brandbook v1.0) — prime sur le `.docx` §15 et sur `tokens.ts` en cas de drift.
  - **Palette canonique** : Noir `#0A0A0A`, Or SPAWT `#C8A44E`, Or clair `#E8D5A0`, Vert Chat `#2D6B4F`, Vert Chat foncé `#1F4D39`, Blanc cassé `#FAFAF8`, Ambre `#E89A39`, Crème sable `#EFE8DC`, Blanc pur `#FFFFFF`, Graphite `#333333`, Gris moyen `#8A8A8A`. Token `--alert-red` à définir (UX-DR2 — revue Alexandre + Stéphanie).
  - **Typographie canonique** : Klinsman (display) + Gotham (body). Fichiers dans `documentation/ux/fonts/`.
- **i18n strings (NFR-I18N-01, FR-003)** : `app/src/i18n/fr.json` — fichier unique langue par défaut `fr-CI`.
- **Anti-fraude (DR-FRAUD-01 à 06, NFR-FRAUD-01 à 06)** : `app/src/types/spawt.ts:81-100` (`ANTIFRAUD_RULES` côté client, informatif) + triggers SQL Supabase Phase 1.3 (enforcement).
- **Data source adapter (règle d'or `lib/data-source.ts`)** : `app/src/lib/data-source.ts` (interface) + `app/src/lib/data-source.supabase.ts` (impl., chargé via `await import()`).
- **Moteurs purs** : `app/src/lib/matching.ts` (FR-004 score), `app/src/lib/palais-engine.ts` (FR-025 décroissance), `app/src/lib/chat-voice.ts` (FR-003 voix du chat).
- **Stores Zustand** : `app/src/store/spawter-store.ts` (persistant, FR-008 à FR-012) + `app/src/store/onboarding-draft.ts` (éphémère, FR-002).

### Drift de vocabulaire détecté dans le `.docx` source

Le `.docx` PRD V1.0.0 utilise localement des termes hors-canon SPAWT (mots à privilégier en V1.5 pour cohérence du vocabulaire défini en §19 Glossaire) :

- « check-in » (PRD §3.1 Feature 5 titre, §7.1) → privilégier « spawt » (verbe) ou « Le Guet » (mécanisme).
- « utilisateur » (PRD §3.1 Feature 7, §20.7) → privilégier « spawter ».
- « restaurant » (PRD §1.3, §2.2, §3.1, etc.) → privilégier « lieu ».
- « VTC » (Executive Summary, FR-006, Innovation Analysis) → conservé **uniquement comme analogie descriptive** du mécanisme passif (« type VTC »). Le nom canonique du mécanisme dans toute copy produit / string UI reste **« Le Guet »** — jamais « VTC » dans une string UI (cohérent avec le drift D6 de la spec UX).
- « user » (PRD §13.1, §13.3 noms de tables `user_palais`, `user_signals`) → conservé techniquement, mais les amendements team §4.1 renomment la table B2C en `spawters`. Les noms de tables `user_*` restent (drift accepté par cohérence schéma DB déjà partiellement migré).
- « gamification », « leaderboard », « ranking » : absents du PRD (conformité Contrat à la Tribu §20.1 respectée).

### Notes de fidélité .docx vs conformité BMAD

Aucun sacrifice majeur. Quelques arbitrages mineurs :

1. **Reformulation FRs en « Users/Spawters can »** : le PRD source décrit souvent les features en « Le système permet », reformulé en « Le spawter peut » conformément BMAD information density rule.
2. **Suppression d'adjectifs subjectifs** : « instinctif », « rapide », « simple » remplacés par des seuils chiffrés ou supprimés des FRs (gardés dans Executive Summary et Innovation Analysis qui tolèrent du langage marketing).
3. **NFRs explicités** : le PRD source mentionne « APK < 50 Mo », « réseau 3G instable », sans format « shall ... measured by ». Reformulé strict.
4. **Amendements Claude `[pending]`** : non intégrés sauf FR-033 (suppression compte) qui est imposé par DR-ARTCI-05 indépendamment du statut de l'amendement 5.2. À retraiter en V1.5.

### Changelog du PRD restructure BMAD

- **v1.0 (2026-05-13)** — Restructure initiale BMAD du PRD V1.0.0 .docx (John BMad, 2026-04-09). Amendements team §4.1–§4.7 intégrés ; amendements Claude §5.1–§5.8 marqués `[pending]` sauf §5.2 (FR-033) imposé par Loi 2013-450.

- **v1.0.1 (2026-05-13)** — Remédiations post-validation `bmad-validate-prd` Top 3 :
  - **Ajout Journey 5 — Upgrade Spawter Gold** (13 étapes) couvrant SC-REV-01 à SC-REV-05, reliant FR-015, FR-020, FR-021, FR-022, FR-038 à un parcours user-side. Lacune traçabilité résolue.
  - **Ajout section « Store compliance & permissions »** (PTR-STORE-01 à 04) couvrant Apple App Store Guidelines, Google Play Console, permissions manifest Android + iOS, age rating 17+.
  - **PTR-OPS-01** : « quelques minutes » → « maximale 5 minutes (cf. NFR-AVAIL-03) ».
  - **FR-024, FR-025** : « JSONB » → « payload JSON structuré » / « structure JSON » (DB-agnostique).
  - **FR-031** : path `src/theme/tokens.ts` retiré du corps → consigné en Annexes.
  - **Choix Supabase conservé** : NFR-AVAIL-01 / NFR-SEC-01 à 03 / NFR-CAP-01 à 03 inchangés — arbitrage fondateur figé V1.

- **v1.0.2 (2026-05-13)** — Remédiations post-validation Reste-à-traiter (non-bloquant, hors Top 3) :
  - **FR-006 + Journey 2.6** : placeholder copy `[NOM]` → `{place_name}` (cohérence i18next, clé `notif.guet.prompt`).
  - **DR-CGV-01 étendu en 7 sous-DRs `[pending juriste]`** : DR-CGV-01 (droit applicable + acceptation), DR-CGV-02 (rétractation 7j), DR-CGV-03 (résiliation Gold + grace), DR-CGV-04 (remboursement Mobile Money), DR-CGV-05 (PI UGC + licence non-exclusive), DR-CGV-06 (modération communautaire + contestation), DR-CGV-07 (juridiction Abidjan + médiation). Sert de checklist juriste.
  - **8 amendements Claude §5.x du cahier dispositionnés** (voir Annexe « Disposition des amendements Claude §5.x ») :
    - §5.1 → **NFR-OBS-04** (events.md single source of truth).
    - §5.2 → **FR-040** (écran consent ARTCI à l'onboarding, bloquant) — complète FR-033 déjà intégré v1.0.
    - §5.3 → déjà accepté v1.0 (DR-FRAUD + NFR-FRAUD).
    - §5.4 → **FR-032 amendé** (avis seed `is_seed = true` × 150-300) + **FR-026 amendé** (alimente ADN, exclu compteur public).
    - §5.5 → **FR-041** (système feature flags 4 scopes).
    - §5.6 → **NFR-I18N-01 promu partial → full** + **NFR-I18N-02** ajouté (lint vocab bloquant).
    - §5.7 → déjà accepté v1.0 (NFR-PERF + PTR-DEV).
    - §5.8 → process (cahier §5.8), non rapatrié dans le PRD ; faisabilité technique via FR-041 scope `internal`.
  - **Sign-off requis** pour basculer `[pending]` → accepté formel : Stéphanie + Kidam + Alexandre (triple sign-off).
  - **PRD compte désormais 41 FRs** (vs 39 v1.0) et **41 NFRs** (vs 39 v1.0) + **24 DRs** (vs 18 v1.0).

- **v1.0.3 (2026-05-14)** — Erratum post-`bmad-check-implementation-readiness` (rapport `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-14.md`). **Aucune exigence ajoutée, retirée ou re-scopée** — réalignement de texte obsolète sur des artefacts aval déjà décidés :
  - **FR-031 — palette/typo réalignées sur le kit canonique** : l'`Acceptance` citait encore les valeurs du `.docx` §15 (Or `#D4AF37`, Vert Chat `#50C878`, Blanc cassé `#F8F6F0`, Instrument Serif / Manrope / JetBrains Mono). Remplacées par la palette canonique `documentation/ux/spawt-tokens.css` (Or `#C8A44E`, Vert Chat `#2D6B4F`, Blanc cassé `#FAFAF8`, etc.) + typographies **Klinsman + Gotham**. Token `--alert-red` signalé comme à définir (UX-DR2).
  - **Annexe « Localisation des artefacts » étendue** : ajout d'un bloc de référence brand canonique (palette + typographie + source `documentation/ux/`).
  - **Convention des références `§` explicitée** : note ajoutée en tête du « Mapping FR/NFR ↔ section PRD source » — les renvois `§` pointent vers le `.docx` source, pas vers ce `PRD.md`.
  - **Drift vocabulaire « VTC »** : ligne ajoutée — « VTC » conservé comme analogie descriptive uniquement ; nom canonique du mécanisme en copy = « Le Guet » (drift D6 de la spec UX).
  - **Comptes corrigés** : « 40 NFRs » → « 41 NFRs » et « 23 DRs » → « 24 DRs » (décompte réel des identifiants NFR- / DR- présents).
  - **Hors scope de cet erratum** (autres artefacts) : l'inexactitude « admin → V1.5 » de la spec UX et les 3 corrections de structure des epics — à traiter sur `ux-design-specification.md` / `epics.md`.

---

**Document généré le 2026-05-14 — PRD BMAD v1.0.3 (erratum post-`bmad-check-implementation-readiness`, du PRD V1.0.0 John BMad du 2026-04-09).**
