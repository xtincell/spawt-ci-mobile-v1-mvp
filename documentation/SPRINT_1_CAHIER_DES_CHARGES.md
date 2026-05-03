# SPAWT — Cahier des charges Sprint 1

| | |
|---|---|
| **Version** | 1.0.0 |
| **Date** | 2026-05-03 |
| **Auteur** | Consolidation Claude pour validation team |
| **Référence amont** | `documentation/SPAWT_PRD_V1.docx` (PRD V1.0.0, John BMad, 9 avril 2026) |
| **Plan d'arbitrage** | `C:\Users\x-tin\.claude\plans\on-a-recu-le-staged-orbit.md` |
| **Personas opérationnelles** | [Stéphanie](personas/stephanie.md) (qualité), [Kidam](personas/kidam.md) (performance produit), [Alexandre](personas/alexandre.md) (stratégie & marque) |
| **Statut** | À valider en revue team — sections marquées `[Claude — pending team validation]` |

---

## 1. Contexte

Le PRD V1 propose 19 features pour le MVP livrables sur 4-6 mois. Suite à la revue team du 3 mai 2026 (WhatsApp), Alexandre a priorisé **12 features pour Sprint 1** (les 10 premières + Partage WhatsApp + Admin panel) et la team a remonté **7 amendements modèle de données**. Claude propose en complément **8 amendements de qualité MVP**, à valider.

Ce document fige le périmètre, les amendements, les critères d'acceptation et le plan de vérification. Il sert de référence unique avant ouverture des tickets dev.

---

## 2. Triple regard de qualité (personas)

Chaque feature livrée passe les **3 portes** :

| Porte | Persona | Critère central |
|---|---|---|
| **Qualité** | [Stéphanie](personas/stephanie.md) | Le build tient sur le terrain (4 devices, 3G, batterie faible) |
| **Performance produit** | [Kidam](personas/kidam.md) | La feature déplace une métrique AARRR mesurable |
| **Stratégie & marque** | [Alexandre](personas/alexandre.md) | La feature renforce Instinct / Identité / Communauté et respecte le Contrat |

**Aucune feature n'est mergée sans triple sign-off.** Pour chaque ticket, ces 3 noms sont des reviewers obligatoires (ou leurs deputies désignés).

---

## 3. Périmètre fonctionnel Sprint 1

### 3.1 Les 12 features priorisées

| # | Feature | Complexité | Brique critique |
|---|---|---|---|
| 1 | Inscription / Authentification (OTP Twilio/Termii + Google Sign-In secondaire) | M | Phone+OTP primaire |
| 2 | Onboarding léger (5 questions calibrage Palais → §20.2 PRD) | S | Palais initial -40/+40 |
| 3 | Feed personnalisé de lieux (score composite §8.1) | L | Coeur valeur produit |
| 4 | Fiche lieu (radar ADN si ≥5 avis, badges spéciaux, signaux sociaux) | M | Page de conversion |
| 5 | Check-in « Le Spawt » (mécanisme VTC, 10m, 15min, snooze x3, fenêtre +30min) | M | **Brique data centrale** |
| 6 | Avis structuré (note /5 + tags + texte 500c + 3 photos), pondéré par stade (1x → 3x) | M | Alimente ADN |
| 7 | Profil utilisateur (radar 2 axes free / 5 axes premium, collection titres) | M | Vitrine identité |
| 8 | 5 stades de maturité (Touriste → Guide, par spots uniques) | S | Inclus Sprint 1 |
| 9 | Sauvegarde / Favoris | S | |
| 10 | Recherche + Filtres (cuisine, budget, distance, note) | M | |
| 16 | Partage WhatsApp (deep link fiche lieu, image + nom + note) | S | Remplace Mode Crew |
| 19 | Admin panel basique (CRUD lieux, modération signalements, métriques) | M | React + Refine ou AdminJS |

### 3.2 Inclusions partielles

- ✅ **Niveau d'évolution du spawter (5 stades)** : inclus Sprint 1.
- ⏳ **Archétypes & mues** : Sprint 2 (post Sprint 1).
- ✅ **Note communautaire pondérée + note globale** : inclus Sprint 1.
- ✅ **Badges Sprint 1 minimal** : 1 seul badge `Premier Spawt` (verrou activation, levier `ACTIVER` §10.3). Les 4 autres (Traversée, Noctambule, Chasseur de Pépites, Palais Diversifié, Éclaireur) sont reportés à V1.5 conformément au PRD §3.1 Feature 18 reportée.

### 3.3 Hors Sprint 1 (mais MVP global PRD)

11 Carte interactive Mapbox · 12 Coup de Cœur · 13 Notifications push · 14 Paywall géo · 15 Paiement Mobile Money (CinetPay) · 17 Modération · 18 Création de fiche lieu (assurée par seed équipe) · Archétypes & mues.

---

## 4. Amendements modèle de données — décidés par la team

Source : revue WhatsApp 3 mai 2026, formalisée dans le plan `on-a-recu-le-staged-orbit.md`.

### 4.1 Séparation `spawters` / `spawt_staff`

> *« Je ne vois pas de table pour les users de type SPAWT — il serait plus prudent de ne pas les garder dans la même table que les Spawters. »* — Alexandre

- Table publique B2C renommée `spawters` (cohérence glossaire §19).
- Nouvelle table `spawt_staff` (équipe interne, modérateurs, allies terrain, admin panel).
- Toutes FK actuellement `users(id)` (`user_palais`, `spawter_progression`, `collection_titres`, `mue_tracking`, `spawt_checkin`, `user_signals`) → `spawters(id)`.

### 4.2 Nouvelle table `customers`

> *« Rajouter une table Customer. […] Pour avoir les détails on pourra faire des jointures. »* — Alexandre

- Sépare l'entité **applicative** (`spawters`) de l'entité **commerciale** (`customers`).
- Un spawter B2C a 0 ou 1 customer (créé au moment de l'upgrade Gold).
- En V1.5 B2B : un customer peut être lié à un `place` (Pro / Gold).
- `subscriptions.customer_id` et `invoices.customer_id` pointent vers `customers.id`.
- Le champ `customer_type` migre de `subscriptions` vers `customers`.

### 4.3 Nouvelle table `plans`

> *« Créer une table dédiée aux plans (elle contiendra en même temps prix_ht). […] Le plan Gold en CIV ne sera pas forcément facturé pareil à Lagos. »* — Alexandre

```sql
plans (
  id           UUID PK,
  code         VARCHAR(40),    -- gold_monthly, gold_annual, pro, b2b_gold
  label        VARCHAR(100),
  price_ht     INTEGER,        -- valeur absolue dans la devise référence
  currency_id  UUID REFERENCES currencies(id),
  country_code VARCHAR(2),     -- CI, NG (futur)
  period       VARCHAR(20),    -- monthly, annual
  is_active    BOOLEAN,
  created_at   TIMESTAMP
)
```

`subscriptions.plan_id` remplace l'enum `plan VARCHAR(20)`.

### 4.4 Nouvelle table `currencies`

> *« Tu anticipes sur le multicurrencies ? Well pertinent. La fondation OK, on ship le reste après. »* — Alexandre

```sql
currencies (
  id            UUID PK,
  code          VARCHAR(3),    -- ISO 4217 (XOF, NGN, ...)
  label         VARCHAR(50),
  base_rate     DECIMAL(12,6), -- taux vers monnaie référence interne
  modifier      DECIMAL(6,4) DEFAULT 1.0, -- modificateur d'affichage contextuel
  country_code  VARCHAR(2),
  is_active     BOOLEAN
)
```

- Sprint 1 seed : XOF (CIV par défaut), `is_active = true`.
- Hooks de conversion prêts mais inactifs.

### 4.5 Champs sur `spawters`

```sql
spawters (
  ...,
  country_code         VARCHAR(2),    -- pays de résidence
  origin_country_code  VARCHAR(2),    -- pays d'origine déclaré (data culturelle)
  gender               VARCHAR(20),   -- enum (homme/femme/autre/non_renseigné)
  age_range            VARCHAR(10),   -- enum (18-24, 25-34, 35-44, 45-54, 55+)
  ...
)
```

- Collectés à l'onboarding (Feature 2) — voir aussi §5.2 ci-dessous (consentement Claude).

### 4.6 Politique d'historisation (par défaut : overwrite)

> *« Par défaut, overwrite. Historisé peut être une bonne idée mais ça va terriblement alourdir la BD. »* — Alexandre

| Table | Politique Sprint 1 | Note |
|---|---|---|
| `user_palais` | Overwrite | Historisation = évaluation V1.5+ pour tendances par BU |
| `spawter_progression` | Overwrite | Historique des stades disponible via `collection_titres` |
| `collection_titres` | Append | Historique titres = mémoire d'identité du spawter |
| `user_signals` | **Append-only** | Critique : matière première du ML (PRD §13.3) |

### 4.7 Clarifications check-in à figer (à trancher avec tech lead avant kickoff)

- `session_duration_minutes` : **Décision proposée** : calculé en temps réel `now() - checked_in_at` tant que `left_at` est null, snapshot final à la sortie. À confirmer.
- Définition « fin de session » : **Décision proposée** : `left_at` = sortie du périmètre 10m détectée OU expiration fenêtre +30 min après notification, selon le premier survenu. Logout applicatif **ne** termine **pas** une session check-in en cours. À confirmer.

---

## 5. Amendements proposés par Claude `[pending team validation]`

> Ces 8 amendements sont proposés par l'assistant en revue qualité du PRD + amendements team. Chacun peut être accepté, modifié ou rejeté en revue. Ils n'engagent rien tant qu'Alexandre, Kidam ou Stéphanie n'ont pas signé.

### 5.1 Taxonomie d'événements analytics figée avant code `[pending]`

**Levier (Kidam)** : sans dictionnaire d'événements, les KPIs Engagement / Activation / Rétention demandés par Madame Sun ne sont pas calculables.

**Action** : créer `documentation/analytics/events.md` listant ~30 events + leurs propriétés, snake_case, validés par Kidam. Tickets dev référencent `EVT-XX` au lieu de définir leurs events ad hoc.

**Pré-Sprint 1** : 1 jour de session Kidam + Tech Lead.

### 5.2 Conformité ARTCI / Loi 2013-450 dès Sprint 1 `[pending]` 🚨

**Levier (Stéphanie + légal)** : le PRD §20.7 reconnaît l'obligation mais Sprint 1 n'inclut pas le flow consentement. Le check-in (Feature 5) **est** géoloc continue → infraction au lancement.

**Action** :
- Écran consentement géoloc à l'onboarding (avant la Q1 calibrage). Wording explicite : usage check-in uniquement.
- Mention explicite de la collecte `gender` / `age_range` / `origin_country_code` (PII) au moment de la demande.
- Lien CGU/CGV + politique de confidentialité dans Profil → Paramètres.
- Endpoint `DELETE /me` (soft-delete sur `spawters`, anonymisation après 30 jours).
- Export data utilisateur (JSON download) en self-service depuis Profil.

**Coût** : ~3 jours dev + rédaction CGU par juriste (à externaliser).

### 5.3 Anti-fraude Level 1 inclus dans Feature 5 (pas attendre Feature 17) `[pending]` 🛡️

**Levier (Stéphanie + Kidam)** : les 6 règles PRD §20.4 ne sont pas de la modération humaine — ce sont des invariants techniques (fréquence, vitesse GPS, cohérence arrivée/départ). Sans elles, la beta produit des spawts fictifs qui poisonnent durablement l'ADN et le Palais.

**Action** : intégrer les 6 règles dans `Feature 5 — Check-in` :
- Fréquence même lieu : 1 spawt / 4h (UNIQUE constraint pondéré)
- Fréquence globale : 5 spawts/jour (flag au-delà)
- Vitesse > 100 km/h entre 2 spawts → flag automatique
- Spawt sans géoloc → marque `is_verified = false`, poids 0.5x
- Pattern 10+ spawts identiques en 7 jours → compte flagged
- Cohérence : si `left_at - arrived_at < 5 min` ET check-in actif → flag suspect

Implémentés en triggers SQL + colonnes `flag_reason` sur `spawt_checkin`. Pas de workflow humain (c'est Feature 17 reportée).

### 5.4 Cold start qualitatif — 3 avis fondateurs par lieu `[pending]` 💎

**Levier (Alexandre + Kidam)** : avec 5+ avis requis pour afficher un ADN, 100% des fiches montreront « ADN en construction » au lancement → la valeur produit n'est pas visible. Stéphanie : on ment au user en lui montrant une promesse non tenue.

**Action** :
- Champ `is_seed BOOLEAN` sur `spawt_checkin` (ou table dédiée `seed_reviews`).
- Avis fondateurs alimentent l'ADN mais sont exclus du compteur public.
- 50-100 lieux × 3 avis fondateurs = 150-300 avis seed. Tâche allies + équipe en Phase 0.
- Marquage clair en admin panel : « avis fondateur » distinct des avis communauté.

### 5.5 Feature flags système dès Phase 0 `[pending]` 🚀

**Levier (Stéphanie)** : 12 features ne mergent pas en même temps. Sans flags, on a des longues branches conflictuelles ou du code mort visible aux beta-testeurs.

**Action** : table `feature_flags(spawter_id NULL, flag_code, enabled, scope)` + hook React Native `useFlag(code)`. Scope `internal` / `alpha` / `beta` / `prod`. Permet d'ouvrir progressivement chaque feature.

**Coût** : 2 jours en Phase 0. Économie : pas de longue branche, alpha plus tôt.

### 5.6 i18n strings extraites dès Sprint 1 `[pending]` 🌍

**Levier (Alexandre + future portabilité)** : PRD §18.1 décision #5 : *« Design portable, zéro énergie d'exécution »* sur le multi-villes. Hardcoder les strings FR = refaire Sprint 1 quand Lagos arrive (M12). Coût trivial maintenant, élevé plus tard.

**Action** : `i18next` + `fr.json` dès Sprint 1. Pas de traduction, juste l'extraction. EN ajoutable en 1 sprint plus tard.

**Bonus brand (Alexandre)** : audit verbal automatique (lint script) qui détecte les mots interdits hors-glossaire (`user`, `restaurant`, `like`, `points`, `level`, `score`) dans `fr.json`.

### 5.7 Performance budget chiffré + matrice devices `[pending]` 📱

**Levier (Stéphanie)** : PRD identifie le risque OS-tue-app sur Tecno/Infinix mais sans protocole de test. Les premiers spawters d'Abobo et Yopougon ne sont pas sur iPhone 15.

**Action — Définition de Done Sprint 1** :
- Time to first feed (P95) < 3s sur 3G simulé + Android mid-range
- Bundle JS initial < 500 KB gzippé
- APK < 50 MB (déjà PRD §14.1)
- Test manuel obligatoire avant merge sur 4 devices : 1× Tecno Spark, 1× Infinix Hot, 1× Samsung A-series, 1× iPhone (récent et 1 modèle 2 ans).
- Matrice de tests partagée dans `documentation/qa/device_matrix.md`.

### 5.8 Alpha interne 5 spawters en fin de Sprint 1 `[pending]` 🎯

**Levier (Stéphanie + Kidam)** : PRD prévoit la beta à 20-30 foodies en Phase 4 (semaine 14-18). C'est trop tard pour valider le mécanisme VTC qui est la brique la plus risquée. Si le geofencing 10m / timer 15min ne marche pas en conditions réelles, on l'apprend en mois 5 — désastre.

**Action** : alpha fermée à 5 personnes (Pioneer + Co-Pilots + 2 spawters externes de confiance) pendant 1 semaine en fin de Sprint 1. Focus exclusif : check-in fiabilité. Métriques :
- % check-ins déclenchés correctement vs visites réelles annoncées
- Précision GPS médiane mesurée
- Crashs OS Android par device
- Temps réel d'envoi notification après détection

Si KO : pivot manuel obligatoire (check-in via QR code dans le maquis ?) avant Sprint 2.

---

## 6. KPIs à figer avec Madame Sun CIV (avant kickoff)

Sprint 1 instrumente la collecte. Les **formules** sont à figer collectivement.

| KPI | Hypothèse de formule à valider |
|---|---|
| **Engagement rate** | (sessions × actions clés) / (jours actifs × spawters actifs) sur la période |
| **Tx d'activation** | Cohorte d'inscription : % ayant fait ≥1 spawt complet à J+7 |
| **Retention rate** | Cohorte mensuelle : % ayant ouvert l'app entre J+28 et J+34 |

**Action** : session 30 min Alexandre + Madame Sun + Kidam + Tech Lead avant le sprint planning Sprint 1. Output : `documentation/kpis/formulas.md`.

---

## 7. Plan de livraison Sprint 1 (estimation)

Aligné sur PRD §17 Phase 0 + Phase 1.

| Phase | Durée | Livrables | Owner principal |
|---|---|---|---|
| **Phase 0 — Setup** | Semaine 1-2 | Monorepo, design tokens, schéma DB v1 (avec amendements 4.1-4.5), CinetPay sandbox, Mapbox, **+ feature flags (5.5)**, **+ i18n setup (5.6)**, **+ events.md (5.1)**, **+ device matrix (5.7)** | Tech Lead |
| **Phase 1.1 — Core Auth + Onboarding** | Semaine 3-4 | Features 1, 2 + consent screen (5.2) | Dev backend + Dev mobile |
| **Phase 1.2 — Lieux + Feed** | Semaine 4-6 | Features 3, 4, 9, 10 + seed avis fondateurs (5.4) | Dev mobile + équipe terrain |
| **Phase 1.3 — Check-in & Avis** | Semaine 6-8 | Features 5, 6 + anti-fraude L1 (5.3) | Dev backend + Dev mobile |
| **Phase 1.4 — Identité & Admin** | Semaine 8-10 | Features 7, 8, 16, 19 + badge Premier Spawt | Dev mobile + Dev admin |
| **Phase 1.5 — Alpha** | Semaine 10-11 | Alpha 5 spawters (5.8) — focus check-in | Stéphanie + Kidam |

**Estimation totale : 11 semaines** (vs 8 PRD initial — différence couvre les amendements Claude). 2-3 devs full-stack + 1 designer + équipe terrain en parallèle.

---

## 8. Définition de Done — Sprint 1

Une feature est **Done** quand :

1. **[Stéphanie]** Tests unitaires + manuels sur 4 devices + 3G simulé + Sentry vert 48h en alpha
2. **[Kidam]** Events analytics émis + dashboard de la métrique cible visible + cohorte mesurée
3. **[Alexandre]** Audit verbal (vocabulaire SPAWT) + voix du Chat conforme par stade + Test Tantie Rose passé
4. **[Tech Lead]** Code reviewé + migrations réversibles + feature flag opérationnel + i18n extrait
5. **[Toutes portes]** Triple sign-off explicite avant merge sur main

---

## 9. Vérification end-to-end avant kickoff Sprint 2

| # | Action | Owner |
|---|---|---|
| 1 | Diff DB schema avant/après amendements 4.x — diagramme validé | Tech Lead |
| 2 | Grep PRD : toutes les FK `users(id)` remplacées par `spawters(id)` | Claude / Tech Lead |
| 3 | `plans` seedé avec Gold mensuel CIV + Gold annuel CIV (XOF) | Tech Lead |
| 4 | Validation Madame Sun : champs démographiques + origine permettent ses 3 KPIs | Madame Sun |
| 5 | Audit verbal du build alpha (Alexandre) : 0 mot interdit dans la copy visible | Alexandre |
| 6 | Matrice devices remplie + screen recordings disponibles | Stéphanie |
| 7 | Dashboard funnel onboarding → 1er spawt instrumenté de bout en bout | Kidam |
| 8 | Sign-off Alexandre sur le périmètre Sprint 1 final (12 features + amendements) | Alexandre |

---

## 10. Décisions ouvertes — à trancher en revue team

À résoudre avant ouverture des tickets :

1. **Acceptation/rejet des 8 amendements Claude (§5.1 → §5.8)** — pour chacun : accepter / modifier / rejeter avec justification.
2. **Précisions check-in (§4.7)** — formule `session_duration_minutes` et définition « fin de session ».
3. **Formules KPIs (§6)** — Engagement, Activation, Rétention.
4. **Allocation devices** — qui possède quel device pour la matrice de test (§5.7) ?
5. **Budget consent juridique (§5.2)** — qui rédige les CGU/CGV conformes droit ivoirien ?

---

*Fin du cahier des charges Sprint 1 — version 1.0.0, à valider en revue team du 2026-05-XX.*
