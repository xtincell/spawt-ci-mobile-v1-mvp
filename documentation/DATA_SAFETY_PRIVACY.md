# SPAWT — Data Safety (Google) & App Privacy (Apple) : mapping exact

> Réponses à recopier telles quelles dans les deux formulaires. Établi le 26/07/2026
> depuis le code réel (migrations Supabase 0001→0034, `app/app.json`, taxonomie
> `documentation/analytics/events.md`). Si une nouvelle donnée est collectée après cette
> date, **mettre ce document à jour AVANT la mise à jour de la fiche store** — une
> déclaration fausse est un motif de retrait d'app.
>
> **Position de principe SPAWT (les deux stores)** :
> - Aucune **vente** de données. Aucun **partage publicitaire**. Aucun **tracking
>   inter-apps** (pas de SDK pub, pas d'ATT nécessaire côté Apple).
> - Les seuls tiers qui touchent des données sont des **sous-traitants** agissant pour
>   SPAWT : hébergeur (VPS/Coolify), Termii (envoi des SMS OTP), Sentry (crashs),
>   Expo/FCM/APNs (acheminement des push). Au sens de Google, un transfert à un
>   sous-traitant (« service provider ») **ne compte pas comme “partagé”**.
> - Chiffrement **en transit** : oui (HTTPS/TLS sur toutes les liaisons app ↔ backend).
> - Suppression : **in-app** (Profil → suppression de compte, RPC `request_account_deletion`,
>   anonymisation immédiate + purge J+30 — migration 0029) **+ page web publique de
>   demande de suppression** (exigence Google) : prévoir
>   `https://spawt.online/legal/suppression-compte` **[page à créer — À VALIDER PAR JURISTE]**.

---

## 1. Google Play — formulaire Data Safety

### 1.1 Questions générales (section « Data collection and security »)

| Question Google | Réponse | Justification |
|---|---|---|
| L'app collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui** | Voir tableau 1.2 |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** | HTTPS/TLS (Supabase/Kong `api.spawt.online`) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** | Suppression in-app + URL web (voir encadré ci-dessus) |
| URL de politique de confidentialité | `https://spawt.online/legal/confidentialite` | Doit être en ligne AVANT de soumettre |
| Votre app a-t-elle fait l'objet d'un audit de sécurité indépendant ? | **Non** | (Facultatif — répondre non) |

### 1.2 Tableau donnée par donnée (à cocher tel quel)

Colonnes = les cases du formulaire Google. « Partagée » = transmise à un tiers **hors
sous-traitants** (donc Non partout ici). « Facultative » = l'utilisateur peut utiliser
l'app sans la fournir.

| Catégorie Google → Type | Collectée ? | Partagée ? | Facultative ? | Finalités à cocher | Détail SPAWT |
|---|---|---|---|---|---|
| Informations personnelles → **Numéro de téléphone** | **Oui** | Non | **Non** (obligatoire : c'est le login) | Fonctionnement de l'app · Gestion du compte | Auth OTP (Edge Functions `otp-send`/`otp-verify`, SMS via Termii = sous-traitant) |
| Informations personnelles → **Nom** | **Oui** | Non | Non (pseudo requis) | Fonctionnement de l'app · Gestion du compte | Nom/pseudo affiché sur les avis et la carte de spawter |
| Informations personnelles → **Autres informations** | **Oui** | Non | **Oui** pour pays d'origine ; date de naissance et commune : cocher selon le parcours final **[vérifier si champs obligatoires dans le build soumis]** | Fonctionnement de l'app · Personnalisation | Date de naissance (vœux d'anniversaire, jamais publique) · commune de résidence · pays d'origine (optionnel, angle nostalgie — désactivable via flag `onboarding-origin-country`) |
| Localisation → **Localisation précise** | **Oui** | Non | **Oui** (opt-in explicite ; l'app fonctionne sans) | Fonctionnement de l'app | Validation des spawts (visites vérifiées) + lieux proches. **Arrière-plan optionnel** (Le Guet, permission « Toujours » demandée séparément, désactivable) |
| Localisation → **Localisation approximative** | **Oui** | Non | Oui | Fonctionnement de l'app | Même flux (si la précise est accordée, l'approximative l'est de fait — Google demande de déclarer les deux) |
| Photos et vidéos → **Photos** | **Oui** | Non | **Oui** (jamais requis) | Fonctionnement de l'app | Photos jointes aux avis + photo de profil (galerie ou caméra) |
| Activité dans l'app → **Autre contenu généré par l'utilisateur** | **Oui** | Non | Oui | Fonctionnement de l'app | Avis (texte + note) publiés sur les lieux, modérés (signalement + file admin) |
| Activité dans l'app → **Interactions dans l'app** | **Oui** | Non | Non | Analyses (Analytics) | `user_signals` + événements produit internes (taxonomie `analytics/events.md`) — analytics **interne**, pas de SDK publicitaire tiers |
| Activité dans l'app → **Historique de recherche dans l'app** | **Oui** | Non | Oui | Analyses | Requêtes de recherche de lieux (événements `search_*`) **[à confirmer selon les events actifs au moment de la soumission]** |
| Infos sur l'app et performances → **Journaux de plantage** | **Oui** | Non | Oui | Analyses | Sentry (sous-traitant). Actif seulement si le DSN est configuré |
| Infos sur l'app et performances → **Diagnostics** | **Oui** | Non | Oui | Analyses | Données de performance Sentry (mêmes conditions) |
| Identifiants de l'appareil ou autres → **Identifiants de l'appareil** | **Oui** | Non | Oui (push opt-in) | Fonctionnement de l'app | Token push Expo/FCM/APNs par appareil (table `push_tokens`, migration 0034) — uniquement si les notifications sont acceptées |

**Tout le reste = Non collecté** : pas d'adresse e-mail obligatoire, pas de contacts, pas
de santé, pas de données financières (aucun paiement in-app — Spawter Gold s'achète sur
le web, hors app), pas d'historique de navigation web, pas de race/ethnie/religion/
orientation (le pays d'origine est déclaré ci-dessus comme « autre information », angle
nostalgie culinaire — **[À VALIDER PAR JURISTE : confirmer que ce champ ne doit pas être
requalifié en donnée sensible]**).

### 1.3 Cases « traitement éphémère »

Ne rien cocher en éphémère : la position des spawts est **enregistrée** (`spawt_checkin`),
donc « collectée », pas éphémère.

---

## 2. Apple — App Privacy (Privacy Nutrition Label)

Formulaire App Store Connect → App Privacy. Réponse à la première question
(« Do you or your third-party partners collect data from this app? ») : **Yes**.

### 2.1 Tableau par catégorie Apple

« Linked to user » = Oui partout où la donnée est rattachée au compte spawter (c'est le
cas de presque tout : l'app fonctionne connectée). « Used for tracking » = **Non partout**
(aucun suivi inter-apps/inter-sites, aucune donnée cédée à des courtiers ou régies).

| Catégorie Apple → Type | Collecté ? | Lié à l'utilisateur ? | Tracking ? | Finalité(s) Apple à cocher | Détail SPAWT |
|---|---|---|---|---|---|
| Contact Info → **Phone Number** | Oui | **Oui** | Non | App Functionality | Login OTP |
| Contact Info → **Name** | Oui | Oui | Non | App Functionality | Nom/pseudo public |
| Location → **Precise Location** | Oui | Oui | Non | App Functionality | Spawts vérifiés + lieux proches ; opt-in ; arrière-plan optionnel (Le Guet) |
| Location → **Coarse Location** | Oui | Oui | Non | App Functionality | Dérivée du même flux + commune déclarée |
| User Content → **Photos or Videos** | Oui | Oui | Non | App Functionality | Photos d'avis + avatar (optionnelles) |
| User Content → **Other User Content** | Oui | Oui | Non | App Functionality | Avis texte/notes ; date de naissance et pays d'origine déclarés ici faute de catégorie Apple dédiée **[ou « Other Data Types » — les deux sont défendables, rester cohérent]** |
| Identifiers → **User ID** | Oui | Oui | Non | App Functionality | UUID spawter (compte) |
| Identifiers → **Device ID** | Oui | Oui | Non | App Functionality | Token push par appareil (si notifications acceptées) |
| Usage Data → **Product Interaction** | Oui | **Oui** | Non | Analytics | `user_signals` + events internes (rattachés au `spawter_id`) |
| Diagnostics → **Crash Data** | Oui | **À vérifier** | Non | App Functionality (stabilité) · Analytics | Sentry. Si la config n'attache PAS l'ID spawter aux events → cocher « Not linked » ; si elle l'attache → « Linked » **[vérifier `app/src/lib/monitoring.ts` avant de cocher]** |
| Diagnostics → **Performance Data** | Oui | idem Crash Data | Non | Analytics | Sentry performance |

**Non collectés (ne pas cocher)** : Financial Info, Health & Fitness, Contacts, Browsing
History, Search History (au sens Apple = recherche **web** ; la recherche in-app est
couverte par Product Interaction), Purchases, Sensitive Info, Advertising Data.

### 2.2 Résultat attendu sur la fiche

- « Data Used to Track You » : **rien** (section absente).
- « Data Linked to You » : Contact Info, Location, User Content, Identifiers, Usage Data
  (+ Diagnostics selon §2.1).
- Pas de prompt ATT dans l'app (aucun tracking) — cohérent, ne pas en ajouter.

---

## 3. Socle juridique & mentions à faire valider

- **Base légale locale** : Loi ivoirienne **n° 2013-450** relative à la protection des
  données à caractère personnel, autorité de contrôle **ARTCI**. Le traitement (collecte
  téléphone/identité/localisation) doit être **déclaré à l'ARTCI** avant le lancement
  public — démarche listée dans `HUMAN_TODO.md` (juriste).
- **Hébergement / transfert transfrontalier** : les données sont hébergées sur un **VPS
  situé hors Côte d'Ivoire** (backend self-hosted Coolify). La loi 2013-450 encadre le
  **transfert de données hors du territoire** (autorisation/déclaration ARTCI, garanties
  contractuelles avec l'hébergeur) : **[À VALIDER PAR JURISTE — vérifier le régime exact
  applicable au transfert vers le pays de l'hébergeur et l'inscrire dans la politique de
  confidentialité]**.
- **Sous-traitants à lister dans la politique de confidentialité** : hébergeur du VPS,
  Termii (SMS), Sentry (crashs), Expo/Google FCM/Apple APNs (push). **[À VALIDER PAR
  JURISTE : clauses de sous-traitance + durées de conservation]**.
- **Durées de conservation à afficher** : compte actif = durée d'usage ; après demande de
  suppression = anonymisation immédiate + **purge complète à J+30** (migration 0029) ;
  `user_signals` : définir une durée **[À VALIDER PAR JURISTE]**.
- **Mineurs** : app déclarée 18+ côté Play (public cible) ; pas de collecte sciemment
  dirigée vers les mineurs — cohérent avec la date de naissance demandée à l'onboarding.
- **Cohérence inter-documents** : ce que cochent les formulaires ci-dessus, ce que dit la
  politique de confidentialité et ce que fait le code doivent raconter **la même
  histoire**. En cas d'écart constaté : corriger le code ou la déclaration, jamais
  « oublier » la donnée.
