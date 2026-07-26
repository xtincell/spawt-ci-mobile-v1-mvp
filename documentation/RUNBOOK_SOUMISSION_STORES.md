# RUNBOOK — Soumission de SPAWT aux stores (Apple + Google)

> **Pour qui :** Alexandre (aucune manipulation de code requise au-delà de copier-coller
> les diffs indiqués — au moindre doute, demander à la tech de faire le commit).
> **Quand :** dès que les comptes Apple Developer et Google Play Console sont ouverts.
> **Docs sœurs :** `STORE_LISTING_FR.md` (textes & screenshots prêts à coller) ·
> `DATA_SAFETY_PRIVACY.md` (réponses exactes aux formulaires de confidentialité) ·
> `HUMAN_TODO.md` (checklist générale).
>
> Les montants et règles cités sont ceux connus au **26/07/2026** (vérifié cahier
> des charges 15/07/2026). Tout ce qui peut bouger côté Apple/Google est marqué
> **[à re-vérifier sur la source officielle au moment de l'exécution]**.

---

## 0. Identités du projet (à garder sous la main)

| Quoi | Valeur |
|---|---|
| Nom de l'app | **SPAWT** |
| Bundle ID iOS / package Android | `com.upgraders.spawt` |
| Projet EAS | `15ac2301-e901-4caa-a8c8-864c6621bcd0` (owner `xtincell`, slug `spawt-mobile-ci`) |
| Version app | `1.1.0` (buildNumber/versionCode : voir `app/app.json`, journalisé dans `RELEASES.md`) |
| Backend de prod | `EXPO_PUBLIC_SUPABASE_URL=https://api.spawt.online` (cf. `MIGRATION_COOLIFY.md`) |
| Abonnement Spawter Gold | **Vendu UNIQUEMENT sur le web** : `spawt.online/gold`. L'app ne vend rien. |
| Pages légales | `spawt.online/legal/confidentialite` · `/legal/cgu` · `/legal/cgv` (doivent être EN LIGNE avant soumission) |

---

## 1. Pré-requis communs (avant Apple ET Google)

### 1.1 Le build final passe par la CI GitHub → EAS

Le pipeline est déjà en place (`.github/workflows/eas-build.yml`) : pousser un tag
déclenche la **triple gate** (typecheck, lint:vocab, i18n:check, tests) puis le build EAS.
Un build dont la gate est rouge ne part jamais — c'est voulu.

| Cible | Comment déclencher | Ce que ça produit |
|---|---|---|
| **iOS store (.ipa)** | tag `build-ios-YYYY-MM-DD-N` (ex. `build-ios-2026-07-28-9`) | build profil `production`, prêt pour TestFlight/App Store |
| **Android alpha (.apk)** | tag `build-android-YYYY-MM-DD-N` | build profil `preview` (sideload testeurs — PAS pour le store) |
| **Android store (.aab)** | GitHub → onglet **Actions** → workflow **EAS Build** → **Run workflow** → platform `android`, profile `production` | app-bundle signé, prêt pour Play Console |

> ⚠️ **Piège Android** : le tag `build-android-*` produit un APK de test, pas le
> `.aab` exigé par Google. Pour le store, utiliser le **Run workflow** manuel avec le
> profil `production` (ou demander à la tech d'ajouter un tag dédié). Dans ce mode
> manuel, le `versionCode` utilisé est celui de `app/app.json` — vérifier avec la tech
> qu'il a bien été incrémenté avant de lancer, et journaliser le build dans `RELEASES.md`.

Commande tag (depuis la racine du repo, branche finale) :

```bash
git tag build-ios-2026-07-28-9        # adapter la date et le N (= buildNumber)
git push origin build-ios-2026-07-28-9
```

Le suivi du build se fait sur https://expo.dev/accounts/xtincell/projects/spawt-mobile-ci/builds
(l'URL exacte apparaît aussi dans les logs du job GitHub Actions).

### 1.2 Secrets et accès à vérifier une fois

- [ ] Secret GitHub **`EXPO_TOKEN`** présent (repo → Settings → Secrets and variables →
  Actions). Il est déjà opérationnel (8 builds livrés) — ne pas y toucher, juste vérifier
  qu'il n'a pas expiré (token créé sur expo.dev → Account settings → Access tokens).
- [ ] Accès au compte Expo **`xtincell`** (il détient le keystore Android managé — c'est
  LA clé de signature Android, sa perte = impossibilité de mettre à jour l'app).
- [ ] `eas-cli` installé sur le poste qui fera les `eas submit` : `npm install -g eas-cli`
  puis `eas login` (compte xtincell). Les commandes `eas …` ci-dessous se lancent
  **depuis le dossier `app/`** du repo.

### 1.3 Environnement de production

Avant le build final destiné aux stores, la tech doit confirmer que le profil EAS
`production` embarque les env vars de prod :

- [ ] `EXPO_PUBLIC_SUPABASE_URL=https://api.spawt.online` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (anon key du backend self-hosted) — sinon l'app store pointera sur le mauvais backend.
- [ ] `EXPO_PUBLIC_SENTRY_DSN` posé (voir §6, checklist finale).
- [ ] Côté backend Coolify : `TERMII_API_KEY` posé et **`MOCK_TERMII=false`** pour que
  l'OTP parte en vrai SMS (voir §3.4 pour l'exception « compte démo reviewer »).

---

## 2. Apple — App Store

### 2.1 Inscription à l'Apple Developer Program

1. Aller sur https://developer.apple.com/programs/enroll/
2. Choisir le type de compte :
   - **Organisation** (recommandé si la structure légale existe) : le vendeur affiché sur
     le store sera la société. Exige un **numéro D-U-N-S** (gratuit chez Dun & Bradstreet,
     compter jusqu'à ~2 semaines d'obtention si la société n'en a pas) et une personne
     habilitée à engager la société.
   - **Individuel** : plus rapide (identité vérifiée en quelques jours), le vendeur affiché
     sera le nom de la personne. OK pour démarrer, migration possible plus tard.
3. Payer **99 USD/an** (vérifié cahier des charges 15/07/2026 —
   [à re-vérifier sur la source officielle au moment de l'exécution]).
4. Attendre l'e-mail d'activation (quelques heures à quelques jours).

### 2.2 Récupérer le Team ID

1. https://developer.apple.com/account → section **Membership details**.
2. Noter le **Team ID** (10 caractères, ex. `A1B2C3D4E5`). Il servira dans `eas.json` (§2.5).

### 2.3 Créer l'app dans App Store Connect

1. https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Si le Bundle ID `com.upgraders.spawt` n'apparaît pas dans la liste déroulante :
   le déclarer d'abord sur https://developer.apple.com/account/resources/identifiers
   (→ **+** → App IDs → App → Bundle ID **explicite** `com.upgraders.spawt`, capability
   Push Notifications cochée, Sign In with Apple cochée — l'app utilise les deux).
   Note : la première exécution d'`eas credentials`/`eas build` peut aussi l'enregistrer
   automatiquement si on connecte le compte Apple à EAS.
3. Renseigner : Platform **iOS** · Name **SPAWT** · Primary language **French (France)** ·
   Bundle ID `com.upgraders.spawt` · SKU `spawt-ios` (libre, invisible du public).
4. Une fois l'app créée : **App Information** → noter l'**Apple ID** de l'app
   (nombre à 10 chiffres, ex. `6749001234`). C'est le **`ascAppId`**.

### 2.4 Créer la clé API App Store Connect (pour `eas submit`)

1. App Store Connect → **Users and Access** → onglet **Integrations** →
   **App Store Connect API** → **Team Keys** → **+**.
2. Nom : `EAS Submit SPAWT` · Rôle : **App Manager**.
3. Télécharger le fichier **`.p8`** (⚠️ téléchargeable UNE SEULE FOIS — le ranger dans le
   gestionnaire de mots de passe de l'équipe, jamais dans le repo). Noter le **Key ID**
   et l'**Issuer ID** affichés sur la page.
4. Lier la clé à EAS : depuis `app/`, lancer `eas credentials`, plateforme **iOS**,
   → **App Store Connect API Key** → **Set up** → suivre l'assistant (il demande le
   `.p8`, le Key ID et l'Issuer ID). Ensuite `eas submit` n'aura plus jamais besoin
   du mot de passe Apple.

### 2.5 Renseigner `app/eas.json` (diff exact)

Remplacer les deux placeholders par les vraies valeurs des §2.2 et §2.3 :

```diff
   "submit": {
     "production": {
       "ios": {
-        "ascAppId": "REMPLACER_ASC_APP_ID",
-        "appleTeamId": "REMPLACER_APPLE_TEAM_ID"
+        "ascAppId": "6749001234",
+        "appleTeamId": "A1B2C3D4E5"
       },
```

(Valeurs d'exemple — mettre les vôtres.) Commit : `docs(store): renseigne ascAppId/appleTeamId`.
Ces deux valeurs ne sont **pas des secrets** (elles sont publiques) — elles peuvent vivre dans le repo.

### 2.6 Credentials de build (`eas credentials`)

Depuis `app/` : `eas credentials` → **iOS** → laisser EAS **générer et gérer
automatiquement** :

- le **certificat de distribution** + **provisioning profile** (signature du .ipa) ;
- la **clé de push APNs** (nécessaire aux notifications — l'app les utilise pour Le Guet).

Ne rien créer à la main dans le portail Apple : EAS s'en charge et les stocke côté Expo.
Il suffit de se laisser guider (connexion avec l'identifiant Apple du compte développeur).

### 2.7 Build iOS + envoi TestFlight

1. Pousser le tag `build-ios-YYYY-MM-DD-N` (§1.1). Attendre le build vert sur expo.dev.
2. Soumettre à App Store Connect :
   ```bash
   cd app
   eas submit -p ios --profile production --latest
   ```
   (`--latest` = reprend le dernier build iOS terminé.)
3. Dans App Store Connect → **TestFlight** : le build apparaît après « Processing »
   (10-60 min). À la première soumission, répondre à la question chiffrement :
   c'est déjà déclaré dans l'app (`usesNonExemptEncryption: false`), donc normalement
   aucune question posée.
4. **Testeurs internes** : TestFlight → **Internal Testing** → **+** créer le groupe
   `Équipe SPAWT` → ajouter les membres (ils doivent d'abord être invités dans
   Users and Access, rôle App Manager/Developer/Marketing suffit ; max 100 testeurs
   internes). Distribution immédiate, **sans review Apple**. Chaque testeur installe
   l'app TestFlight sur son iPhone et accepte l'invitation e-mail.
5. (Optionnel) Testeurs **externes** (beta waitlist) : groupe External Testing → exige
   une **Beta App Review** (~24 h) la première fois.

### 2.8 Fiche App Store + notes de review

Remplir la fiche avec les textes de `STORE_LISTING_FR.md` (nom, sous-titre, description,
mots-clés, screenshots, catégorie **Food & Drink**) et le formulaire **App Privacy** avec
`DATA_SAFETY_PRIVACY.md`. Puis, dans la section **App Review Information** :

**a) Compte démo pour le reviewer (obligatoire : l'app a un login).**
Le reviewer d'Apple est seul devant l'app, quelque part en Californie — il doit pouvoir
se connecter **sans nous**. Trois options, de la plus recommandée à la moins bonne :

1. **Recommandé — numéro de test whitelisté côté serveur** : demander à la tech
   d'ajouter une petite allowlist dans la fonction OTP (`otp-verify`) : pour UN numéro
   dédié (ex. `+225 07 00 00 00 01`, une SIM de l'équipe), un code fixe est accepté,
   pendant que **tous les autres numéros reçoivent le vrai SMS Termii**. C'est la solution
   la plus honnête : le pipeline réel reste actif pour le monde entier, et on documente
   noir sur blanc à Apple « demo number X, verification code Y ». Apple accepte
   parfaitement les comptes démo ainsi documentés.
   - Variante pour la QA interne (TestFlight équipe, pas pour le reviewer) : un vrai
     numéro d'équipe avec l'OTP réel reçu par SMS — impossible pour le reviewer
     (personne pour lui relayer le code), très bien pour nous.
2. **À défaut — mock global documenté** : si Termii n'est pas encore actif au moment de
   la soumission, laisser `MOCK_TERMII=true` (comportement par défaut du backend) et
   écrire dans les notes : « Demo/testing phase: any valid CI number, verification code
   **123456** ». Honnête tant que c'est écrit — mais cela signifie que TOUS les
   utilisateurs sont en OTP mock (acceptable pour une review/TestFlight, pas pour le
   lancement public réel).
3. **À ne pas faire** : donner un numéro dont l'OTP arrive sur le téléphone de l'équipe
   sans allowlist — le reviewer ne recevra jamais le code, rejet garanti
   (motif « unable to log in », très fréquent).

**b) Notes pour l'équipe de review — argumentaire abonnement (guideline 3.1.3(a)).**
Coller (en anglais) quelque chose comme :

> SPAWT is a free community app for discovering food spots in Abidjan, Côte d'Ivoire.
> The optional "Spawter Gold" subscription is a **multiplatform service** purchased
> exclusively on our website (spawt.online), in line with guideline **3.1.3(a)**
> (Spotify/Netflix model). The iOS app contains **no purchase button, no pricing, and
> no link or call to action directing users to an external purchase flow**. Subscribers
> who purchased on the web simply see their Gold status reflected in the app.
> Login is via SMS OTP; a demo number and code are provided above.
> User-generated reviews are moderated (in-app reporting + admin moderation queue),
> and in-app account deletion is available (Profile → settings).

Points de vigilance associés (à vérifier dans le build soumis, la tech confirme) :
- aucun écran de l'app n'affiche de prix Gold ni de lien vers `spawt.online/gold` ;
- l'upsell Gold éventuel dit ce que Gold apporte, sans « Abonne-toi ici » ni URL d'achat.

**c) Échéancier réaliste de review** [à re-vérifier — ordres de grandeur mi-2026] :
- Passage en review : le plus souvent **sous 24-48 h** (Apple annonce ~90 % sous 24 h).
- **Première soumission** d'une nouvelle app : prévoir plus large, et un **aller-retour
  de rejet est courant** (compte démo, métadonnées, permission localisation…). Chaque
  resoumission repart pour ~24-48 h.
- **Budget planning : 1 à 2 semaines** entre la 1re soumission et l'app en ligne.
- Publier en mode **« Manually release this version »** pour choisir le jour J.

---

## 3. Google — Play Store

### 3.1 Compte Play Console

1. https://play.google.com/console/signup — frais uniques de **25 USD**
   (vérifié cahier des charges 15/07/2026 — [à re-vérifier au moment de l'exécution]).
2. **⚠️ Choix crucial : compte Organisation vs Personnel.**
   - **Compte Personnel** : soumis à la règle des tests fermés — l'app doit d'abord
     tourner en **test fermé avec au moins 12 testeurs opt-in pendant 14 jours
     consécutifs** avant de pouvoir demander l'accès à la production (règle Google pour
     les comptes personnels créés après nov. 2023 ; seuil 12 testeurs en vigueur
     mi-2026 — [à re-vérifier sur la source officielle au moment de l'exécution]).
   - **Compte Organisation** (recommandé) : **pas soumis à cette règle**, le vendeur
     affiché est la société. Exige un **numéro D-U-N-S** (le même que pour Apple §2.1 —
     autre bonne raison de le demander tout de suite) + vérifications d'identité de
     l'organisation.
   - **Si compte Personnel malgré tout** : transformer la contrainte en atout — utiliser
     la **beta waitlist SPAWT** comme vivier : créer la piste **Closed testing** dès le
     jour 1, y inviter 20-30 e-mails de la waitlist (marge au-dessus de 12), et lancer le
     chrono des 14 jours pendant que le reste du dossier avance. Les testeurs doivent
     **installer et garder** l'app (opt-in continu).
3. Compléter les vérifications d'identité (pièces, adresse — peut prendre quelques jours).

### 3.2 Créer l'app + service account pour `eas submit`

1. Play Console → **Create app** : nom **SPAWT**, langue **Français**, type **App**,
   **Gratuite**.
2. **Premier upload manuel obligatoire** : l'API Google refuse de créer la toute première
   release. Il faut téléverser le premier `.aab` **à la main** : Play Console →
   **Test and release** → **Internal testing** → **Create new release** → glisser le
   `.aab` téléchargé depuis expo.dev (page du build production, bouton Download).
   Au premier upload, accepter la **Play App Signing** (Google gère la clé de signature
   de distribution — l'upload key reste le keystore managé EAS).
3. **Service account JSON** (pour que les soumissions suivantes passent par `eas submit`) :
   1. https://console.cloud.google.com → créer (ou réutiliser) un projet, ex. `spawt-play` ;
   2. **APIs & Services** → activer **Google Play Android Developer API** ;
   3. **IAM & Admin → Service Accounts** → **Create service account** (nom `eas-submit`) →
      onglet **Keys** → **Add key** → **JSON** → télécharger ;
   4. Play Console → **Users and permissions** → **Invite new users** → coller l'e-mail du
      service account (`eas-submit@…iam.gserviceaccount.com`) → permissions : **Release
      apps to testing tracks** + **Manage production releases** (ou « Admin » sur l'app
      SPAWT uniquement) ;
   5. Ranger le fichier téléchargé dans le repo local à l'emplacement exact
      **`app/secrets/play-service-account.json`** — le dossier `app/secrets/` est
      **gitignoré** : le fichier reste sur le poste, il n'est **jamais commité**.
      (En garder une copie dans le gestionnaire de mots de passe de l'équipe.)

### 3.3 Formulaires obligatoires avant toute release

Dans Play Console, section **App content** (tout est bloquant pour publier) :

- [ ] **Data Safety** : recopier EXACTEMENT le tableau Google de `DATA_SAFETY_PRIVACY.md`
  (doc n°3). Inclut l'URL de politique de confidentialité
  `https://spawt.online/legal/confidentialite` et l'**URL publique de demande de
  suppression de compte** (exigée par Google — voir doc n°3).
- [ ] **Classification du contenu** (questionnaire IARC) : répondre honnêtement —
  pas de violence/jeux d'argent ; **oui** à « les utilisateurs peuvent interagir /
  publier du contenu » (avis + photos, modérés). Résultat attendu : tous publics
  avec mention « Interaction des utilisateurs » [le résultat exact dépend du questionnaire].
- [ ] **Public cible** : 18+ recommandé (compte + géolocalisation ; évite tout le volet
  « Familles » de Google).
- [ ] **Sécurité des données / connexion** : fournir les identifiants démo de review
  (même logique qu'Apple §2.8a — numéro de test + code).
- [ ] Fiche store : textes + screenshots + feature graphic depuis `STORE_LISTING_FR.md`.

### 3.4 Pistes de release : interne → fermée → production

1. **Internal testing** (jusqu'à 100 testeurs, dispo en minutes) : l'équipe valide le
   `.aab` de prod (login OTP réel, backend prod, push).
2. **Closed testing** : promouvoir la release (bouton **Promote release**) → y inscrire
   la beta waitlist. Si compte Personnel : c'est ici que courent les **14 jours / 12
   testeurs** (§3.1).
3. **Production** : demander l'accès production (questionnaire Google sur le test fermé,
   réponse sous ~1-7 jours [à re-vérifier]), puis promouvoir la release en production.
   La **première review Google** d'une nouvelle app peut prendre **jusqu'à 7 jours**
   (souvent moins ; les mises à jour suivantes : quelques heures à 2-3 jours).

Soumissions suivantes (une fois le service account en place) :

```bash
cd app
eas submit -p android --profile production --latest
```

Le profil `submit.production.android` de `eas.json` est déjà configuré :
piste `internal`, statut `draft`, clé `./secrets/play-service-account.json`.
On promeut ensuite interne → fermée → production depuis la Play Console.

---

## 4. FCM — push Android (à faire AVANT le build final Android)

Sans cette étape, l'enregistrement des tokens push échoue sur Android (l'app dégrade
proprement — pas de crash — mais **aucune notif du Guet** n'arrivera).

1. https://console.firebase.google.com → **Add project** → nom `spawt` (l'analytics
   Google est facultatif : le désactiver).
2. Dans le projet : **Add app** → **Android** → package **`com.upgraders.spawt`** →
   télécharger **`google-services.json`**.
3. Placer le fichier dans le repo : **`app/google-services.json`** puis le déclarer dans
   `app/app.json` (diff exact — section `android`) :

   ```diff
      "android": {
        "package": "com.upgraders.spawt",
        "versionCode": 8,
   +    "googleServicesFile": "./google-services.json",
        "adaptiveIcon": {
   ```

   Ce fichier est une config client, pas un secret : il **doit être commité** (sinon la
   CI GitHub ne l'aura pas au moment du build). Commit :
   `docs(store): ajoute google-services.json + googleServicesFile`.
   ⚠️ Vérifier avec la tech que `.easignore` ne l'exclut pas (il ne doit pas être listé).
4. **Clé de service FCM V1 dans EAS** (pour que les serveurs SPAWT puissent envoyer) :
   1. Firebase console → ⚙️ **Project settings** → **Service accounts** →
      **Generate new private key** → un JSON est téléchargé ;
   2. depuis `app/` : `eas credentials` → **Android** → **Google Service Account**
      → **Manage your Google Service Account Key for Push Notifications (FCM V1)**
      → **Set up** → pointer le JSON téléchargé. (Ce JSON-là **est** un secret :
      gestionnaire de mots de passe, jamais dans le repo.)
5. Refaire un build Android APRÈS l'étape 3 (le fichier est embarqué au build) et tester :
   une notif du Guet doit arriver sur un device Android réel.

Côté iOS, rien à faire ici : la clé APNs est gérée par `eas credentials` (§2.6).

---

## 5. Récapitulatif de l'ordre d'exécution

```
J0   Comptes Apple + Google ouverts (99 USD + 25 USD) · demander le D-U-N-S si absent
J0   Firebase + google-services.json + clé FCM V1 (§4)  ──→ commit
J0   eas.json : ascAppId + appleTeamId (§2.5)           ──→ commit
J0   eas credentials (iOS distrib + APNs + clé ASC API)
J1   Builds finaux : tag build-ios-… + Run workflow android/production (§1.1)
J1   eas submit ios → TestFlight interne · upload manuel .aab → piste interne
J1-2 Fiches stores + Data Safety + App Privacy + classification (docs n°2 et n°3)
J2   Play : piste fermée (beta waitlist) — si compte Personnel : chrono 14 jours
J2-3 Apple : soumission en review (notes + compte démo §2.8)
J7+  Apple approuvée → release manuelle · Google : accès production → publication
```

---

## 6. Checklist finale avant de cliquer « Publier »

À cocher en équipe, la veille du lancement :

- [ ] **≥ 20 lieux seedés en base de prod** — règle du cahier des charges (Mission 1 :
  20 lieux onboardés terrain ; cible PRD 50-100 avec avis fondateurs). Une carte vide
  au premier lancement = première impression ratée + risque de rejet « app incomplète ».
- [ ] **Pages légales EN LIGNE** et accessibles sans compte :
  `spawt.online/legal/confidentialite`, `/legal/cgu`, `/legal/cgv` (validées juriste,
  Loi 2013-450/ARTCI). Les URLs sont déclarées dans les deux consoles.
- [ ] **CGU acceptées dans l'app** : l'écran consentement de l'onboarding pointe vers les
  bonnes URLs (les ouvrir depuis l'app pour vérifier).
- [ ] **Screenshots uploadés** sur les deux fiches (plan dans `STORE_LISTING_FR.md`).
- [ ] **Sentry DSN configuré** (`EXPO_PUBLIC_SENTRY_DSN` en env EAS `production`) et un
  crash de test visible dans Sentry — sinon on sera aveugle au lancement.
- [ ] **`EXPO_PUBLIC_SUPABASE_URL` de prod** (`https://api.spawt.online`) dans le build
  soumis — vérifiable sur un device : les lieux affichés sont ceux de la base de prod.
- [ ] **OTP réel actif** (`MOCK_TERMII=false` + `TERMII_API_KEY`) — sauf stratégie assumée
  §2.8a option 2. Test grandeur nature : un numéro CI lambda reçoit son SMS.
- [ ] **Suppression de compte** testée in-app (migration 0029) + URL web de demande de
  suppression en ligne (exigence Google, cf. doc n°3).
- [ ] Push testés sur un iPhone ET un Android réels (notif du Guet).
- [ ] Le build soumis est **journalisé dans `RELEASES.md`** (numéro, date, tag, commit).
- [ ] Apple : version en « Manually release » → on choisit le jour J ensemble.
