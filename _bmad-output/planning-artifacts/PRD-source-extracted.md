---
source: documentation/SPAWT_PRD_V1.docx
extracted_at: 2026-05-13
extractor: PowerShell System.IO.Compression + manual w:p/w:t/w:tbl walk
purpose: Brute extraction fidele du PRD V1.0.0 (John BMad, 2026-04-09) pour audit/tracabilite
---

# SPAWT PRD V1.0.0 - Source Extraction (brute)

# SPAWT ��� Cahier des Charges Produit (PRD)

John, Product Manager (BMad)

9 avril 2026

# SPAWT — Cahier des Charges Produit (PRD)

Auteur : John, Product Manager (BMad) Date : 9 avril 2026 Version : 1.0.0 Statut : Reference unique equipe de developpement Confidentialite : Interne — UPGRADERS x SPAWT

## Table des matieres
- Vue d’ensemble produit
- Personas utilisateurs
- Perimetre MVP (19 features)
- Features post-MVP (18 features)
- Systeme Le Palais
- ADN du Lieu
- Les 3 interactions utilisateur
- Matching instinctif
- Experience utilisateur
- Systeme de badges et progression
- Monetisation
- Architecture technique
- Modeles de donnees
- Contraintes et risques
- Direction artistique
- KPIs et metriques
- Plan de livraison
- Decisions architecturales resolues
- Glossaire SPAWT
- Annexes

# 1. Vue d’ensemble produit

## 1.1 Vision

« Ne plus jamais regretter un restaurant. »

SPAWT est un compagnon de decouverte culinaire communautaire pour les foodies d’Abidjan. Pas un catalogue de restaurants. Pas un TripAdvisor local. Pas une marketplace de reservation. SPAWT est un chat discret, curieux et independant qui guide le mangeur a travers la ville.

## 1.2 Mission

« Nous tuons le temps perdu a chercher ou sortir manger. »

Reduire de 45 minutes a 3 minutes le temps de decision pour choisir un lieu de restauration, grace a un systeme de recommandation personnalise, alimente par une communaute de foodies authentiques.

## 1.3 Probleme resolu

Abidjan compte plus de 15 000 points de restauration. Google Maps en reference 847 dans un rayon de 5 km autour de Cocody. Les solutions existantes (Google Maps, TripAdvisor, groupes WhatsApp) traitent le mangeur comme un consommateur anonyme et proposent les memes recommandations a tout le monde.

Le probleme n’est pas l’offre. L’offre est massive. Le probleme est le filtre. Il n’existe aucun systeme qui comprend ce que toi, personnellement, tu aimes manger, dans quel contexte, avec qui, et pourquoi.

Trois facteurs amplifient ce probleme en Afrique de l’Ouest : 1. La fracture digitale : Tantie Rose a Abobo Baule fait le meilleur attieke d’Abidjan mais n’a ni site web, ni page Instagram, ni fiche Google. 2. La culture de recommandation orale : le bouche-a-oreille ne scale pas au-dela du cercle immediat. 3. L’absence de data culinaire locale structuree : personne ne sait combien de maquis existent a Yopougon ni ce qu’ils servent un mardi vs un samedi.

## 1.4 Proposition de valeur unique

La difference SPAWT tient en trois mots : instinct, identite, communaute.
- Instinct. Le systeme observe les comportements reels du mangeur et construit un profil gustatif multidimensionnel appele le Palais. La recommandation qui en sort n’est pas « les 10 meilleurs restaurants de Cocody ». C’est « ce lieu-la, maintenant, pour toi ».
- Identite. Le mangeur sur SPAWT n’est pas un utilisateur anonyme. C’est un spawter dont le profil culinaire a une trajectoire et une collection de titres gagnes par l’exploration. Le spawter ne consomme pas l’app. Il se decouvre a travers elle.
- Communaute. La data est generee par la tribu — les spawters qui explorent, avisent, recommandent. La qualite de l’information croit avec la taille et la maturite de la communaute. SPAWT ne fonctionne pas sans ses spawters. C’est le design, pas un accident.

## 1.5 Positionnement

« SPAWT est l’app food discovery qui filtre le bruit pour les foodies d’Abidjan. Contrairement a celui qui liste 847 restaurants sans contexte, SPAWT te montre les 5 qui correspondent vraiment a ton envie du moment, valides par des gens comme toi. »

<!-- TABLE START -->
| Critere | Concurrence (Google Maps, TripAdvisor) | SPAWT |
| --- | --- | --- |
| Approche | Utilitaire, universel, impersonnel | Identitaire, local, personnel |
| Notation | Etoiles anonymes | Avis ponderes par credibilite |
| Recommandation | Meme pour tous | Personnalisee via le Palais |
| Origine | Tech occidentale importee | Made in Abidjan, world-class UX |
<!-- TABLE END -->

## 1.6 Marche cible
- Phase 1 : Abidjan (6 millions d’habitants, penetration smartphone >50%, scene culinaire en explosion)
- Phase 2 (M12+) : Dakar
- Phase 3 : Afrique de l’Ouest francophone (Douala, Lagos, Accra)

## 1.7 Origine
- Abidjan. Pleine pandemie. Stephanie Bidje, camerounaise, debarque sans reseau. Google Maps lui propose 847 resultats. Elle passe 1h30 a comparer des avis contradictoires pour un simple dejeuner. Par reflexe de problem solver, elle ouvre un fichier Excel. 47 spots testes en quelques mois. Ce fichier devient le document le plus demande de son cercle. Le fichier Excel de Stephanie est le prototype de SPAWT.

# 2. Personas utilisateurs

## 2.1 Personas B2C

### Betsy Diomande — La Superfan (PERSONA CORE — 70% des decisions produit)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Age | 27-33 ans |
| Lieu | Assinie |
| Metier | Rayonniste Boisson |
| Revenu | 250K-350K FCFA/mois |
| Sorties | 3-4x/mois |
| Tags | Event go-er, Exploration food, Lifestyle social media, Organisatrice de groupe |
| Citation | « Je ne veux pas passer 12 ans a organiser une soiree entre potes » |
| Objectifs | Devenir Brunch Planner, Decouvrir les spots avant tout le monde, Organiser des sorties memorables |
| Frustrations | Trouver des spots, coller aux themes, manque de precision fiches, absence de social proof |
| Canaux | Instagram (MAX), WhatsApp (eleve), Events physiques (moyen) |
| Premium ? | OUI — Sort 3-4x/mois a travers Abidjan. Se rentabilise en 1 sortie. |
<!-- TABLE END -->

### Dominic Koffi — Le Jeune Fetard (CANAL D’ACQUISITION, PAS REVENUE DRIVER)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Age | 18-24 ans |
| Lieu | Yopougon |
| Revenu | 150K FCFA/mois |
| Sorties | 4-6x/mois |
| Tags | Friendly, Outgoing, Beer games pro, Junk food lover, Budget-conscious |
| Citation | « Live fast, Die not that young » |
| Frustrations | Budget limite, veut les bons plans pas chers |
| Canaux | TikTok (MAX), Facebook (eleve), WhatsApp groups |
| Premium ? | NON — Price-sensitive. Freemium only. Sa valeur : partage TikTok, ramene 50 amis. |
<!-- TABLE END -->

### Brice Konan — Le Professionnel Etabli (PERSONA PREMIUM)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Age | 32-39 ans |
| Lieu | Cocody |
| Revenu | 500K FCFA/mois |
| Sorties | 1-2x/mois (qualite > quantite) |
| Tags | Meat lover, Coffee addict, Wine curious, Business lunches |
| Citation | « In Vino veritas » / « Le bon resto, ca se merite » |
| Objectifs | Trouver les meilleurs spots pour impressionner (clients, dates), Ne jamais se tromper |
| Frustrations | Spots « roots mais propres », Temps perdu a reserver, Eviter les deceptions devant invites |
| Canaux | Facebook (eleve), LinkedIn (moyen), Email newsletter (eleve) |
| Premium ? | OUI — Badge dore + reservation 1 tap. Ne veut jamais se tromper. |
<!-- TABLE END -->

### Vanessa Kouakou — L’Influenceuse (LEVIER MARKETING, PAS CLIENT CORE)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Age | 25-31 ans |
| Lieu | Marcory |
| Revenu | 300K FCFA/mois |
| Sorties | 2-3x/mois |
| Tags | Organised, Sugar addict, Cocktail connoisseur, Content creator, Aesthetic obsessed |
| Citation | « Life is too short for boring meals or clothes » |
| Canaux | Instagram (MAX), TikTok (MAX), Pinterest (moyen) |
| Premium ? | NON — Statut Ambassadrice separe. Deal : visibilite IG contre contenu organique. |
<!-- TABLE END -->

## 2.2 Personas B2B

### Tantie Rose — ICP Superfan B2B

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Etablissement | Maquis Chez Tantie Rose, Abobo Baule |
| Proprietaire | Rose Kone, 47 ans |
| Type | Maquis familial cuisine locale authentique |
| CA | 800K-1.2M FCFA/mois, 25-35 couverts/jour |
| Panier moyen | 1 000 FCFA |
| Force | Qualite exceptionnelle |
| Faiblesse | Visibilite quasi-nulle, zero presence digitale |
| Frustration | « Je pourrais servir 100 personnes si les gens savaient. » |
| Tier SPAWT | Spawt Libre (V1) → Spawt Pro via Allie terrain (V1.5) |
<!-- TABLE END -->

### Le Bo Zinc — Etabli Traditionnel

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Etablissement | Restaurant francais haut de gamme, Cocody Riviera |
| Proprietaire | Famille Dembele (Amadou, 52 ans) |
| CA | 14M-16M FCFA/mois, 60-80 couverts/jour |
| Panier moyen | 7 000 FCFA |
| Frustration | Clientele vieillissante, besoin des 30-40 ans |
| Tier SPAWT | Spawt Pro → Spawt Gold (V1.5) |
<!-- TABLE END -->

### Assinie Beach Club — Evenementiel / Hype

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Etablissement | Groupe hotelier (Yvan Toure, 35 ans) |
| CA | 20M-30M FCFA/mois, 200-300 couverts/weekend |
| Panier moyen | 10 000 FCFA |
| IG | 25K followers |
| Frustration | Hype Instagram =/= reservations concretes, dependance influenceurs couteuse |
| Tier SPAWT | Spawt Gold (V1.5) |
<!-- TABLE END -->

### KFC Abidjan — Chaine / Franchise

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Etablissement | 10 locations, Franchise (Sarah Koffi, 38 ans) |
| CA | 150M FCFA/mois, 2000-3000 transactions/jour |
| Panier moyen | 6 000 FCFA |
| Budget marketing | 20M FCFA/mois |
| Frustration | Saturation canaux tradis, concurrence Glovo/Yango (25-30% commission), data client limitee |
| Tier SPAWT | Spawt Gold (V1.5+) |
<!-- TABLE END -->

# 3. Perimetre MVP

## 3.1 Les 19 features retenues pour V1

Estimation totale : 4-6 mois avec 2-3 devs full-stack + 1 designer.

### Feature 1 — Inscription / Authentification

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Porte d’entree de l’application. Telephone + OTP comme methode primaire (standard Afrique de l’Ouest). Google Sign-In en secondaire. Pas de login email/password. |
| Justification | Le SMS OTP est le standard en CI. Chaque utilisateur a un numero de telephone. Social login en secondaire pour les utilisateurs tech-savvy. |
| Complexite | M (moyenne) |
| Provider OTP | Twilio ou Termii (provider local) |
| Donnees collectees | Numero de telephone, nom, quartier |
<!-- TABLE END -->

### Feature 2 — Onboarding leger

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | 3-5 ecrans apres inscription : quartier de residence, type de cuisine prefere, budget habituel, contexte principal (solo/groupe). Genere un Palais initial grossier via 5 questions de calibrage (une par axe bipolaire). |
| Justification | Permet une recommandation des le premier usage sans historique de spawts. Le Palais initial demarre avec des scores entre -40 et +40 (sur une echelle de -100 a +100), laissant 60% de la plage pour le calibrage comportemental reel. |
| Complexite | S (faible) |
| Questions de calibrage | Voir Annexe 20.2 |
<!-- TABLE END -->

### Feature 3 — Feed personnalise de lieux

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Liste ordonnee par pertinence basee sur le score de matching composite (distance + note ponderee + compatibilite Palais/ADN). Mode principal de l’application pour le MVP (un seul mode, pas les 3 modes contextuels de la Bible). |
| Justification | Coeur de la proposition de valeur. Un feed + recherche remplace les 3 modes contextuels (Rapide/Crew/Explore) pour le MVP. |
| Complexite | L (elevee) |
| Algorithme | Score = 0.15cosine + 0.30distance + 0.30note + 0.10recency + 0.15*novelty |
<!-- TABLE END -->

### Feature 4 — Fiche lieu

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Page detaillee d’un lieu : photo, nom, quartier, type de cuisine, fourchette de prix, note communautaire ponderee, horaires, adresse, bouton Appeler + bouton WhatsApp. ADN du lieu affiche en radar quand suffisamment d’avis (5+). Score de matching affiche en pourcentage. Signaux speciaux (Pepite Verifiee, Institution, etc.). |
| Justification | La fiche est la page de conversion : le spawter decide s’il y va ou non. |
| Complexite | M |
<!-- TABLE END -->

### Feature 5 — Check-in (Le Spawt)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Mecanisme de check-in type VTC (Uber/Bolt). Detection geolocalisation passive dans un perimetre de 10 metres. Timer de 15 minutes apres detection d’entree. Notification « Comment c’etait chez [NOM] ? ». Possibilite de snooze (max 3 fois). Fenetre post-sortie de 30 minutes. Check-in passif si pas de reponse (presence prouvee, poids 0.5x). |
| Justification | Brique de base de toute la data. Chaque spawt nourrit le Palais du spawter et l’ADN du lieu. Le mecanisme VTC garantit une presence reelle sans interrompre l’experience culinaire. |
| Complexite | M |
| Donnees collectees | Voir Annexe 20.3 |
| Regles anti-fraude | Voir Annexe 20.4 |
<!-- TABLE END -->

### Feature 6 — Avis structure

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Note globale /5 (obligatoire si avis) + tags rapides a selection multiple (« Copieux », « Rapide », « Ambiance top », « Cher », « A refaire ») + commentaire texte libre (max 500 caracteres, optionnel) + 1-3 photos (optionnelles). Le poids algorithmique de l’avis depend du stade du spawter. |
| Justification | Genere les donnees qualitatives qui alimentent l’ADN du lieu et la credibilite communautaire. |
| Complexite | M |
| Poids par stade | Touriste = 1x, Explorateur = 1.5x, Detective = 2x, Djidji = 2.5x, Guide = 3x |
<!-- TABLE END -->

### Feature 7 — Profil utilisateur

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Nom, avatar, quartier, stade actuel, titre actuel (et titre affiche si different), nombre de spawts, avis donnes, lieux sauvegardes. Palais radar basique (2 axes visibles free, 5 axes premium). Collection de titres. |
| Justification | L’identite est le moat de retention. Le profil est la vitrine de l’identite du spawter. |
| Complexite | M |
<!-- TABLE END -->

### Feature 8 — 5 stades de maturite

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Progression par nombre de spots (lieux uniques spawtes avec check-in verifie). Un spawter qui visite le MEME lieu 10 fois = 1 spot. Seuls les check-ins verifies comptent. |
| Justification | Le systeme recompense la diversite d’exploration, pas la frequentation repetee. Les stades conditionnent le poids des avis, les Coups de Coeur disponibles, et le feature gating premium. |
| Complexite | S |
<!-- TABLE END -->

Tableau des stades :

<!-- TABLE START -->
| Stade | Icone | Seuil (spots uniques) | Comportement |
| --- | --- | --- | --- |
| Touriste | emoji chat | 0-10 | Renifle tout. Palais bouge beaucoup. |
| Explorateur | emoji chat noir | 11-20 | Territoire qui se dessine. Axes se stabilisent. |
| Detective | emoji chat fonce | 21-30 | Sur de son flair. Respecte dans sa zone. |
| Djidji | etoile | 31-50 | Expert reconnu. La colonie ecoute. |
| Guide | cercle | 50+ | Le chat qui marche devant. |
<!-- TABLE END -->

### Feature 9 — Sauvegarde / Favoris

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Sauvegarder un lieu pour plus tard. Liste personnelle consultable dans le profil. Possibilite de retirer un favori. |
| Justification | Feature basique mais essentielle pour la retention. Un lieu sauvegarde est un signal fort pour le matching. |
| Complexite | S |
<!-- TABLE END -->

### Feature 10 — Recherche + Filtres

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Recherche texte (nom du lieu, type de cuisine, quartier) + filtres combinables : type de cuisine, budget (3 tranches), distance, note minimale. |
| Justification | Complement du feed pour les recherches intentionnelles. |
| Complexite | M |
<!-- TABLE END -->

### Feature 11 — Carte interactive

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Vue carte Mapbox avec pins des lieux. Zoom, filtre par categorie. Tap sur un pin ouvre la fiche lieu. Bouton de navigation vers le lieu (deep link Google Maps/Waze). Style dark coherent avec la DA. |
| Justification | La carte est le mode de decouverte geographique. Le paywall geographique y est visuel (lieux hors zone floutes). |
| Complexite | M |
| Provider | Mapbox GL via react-native-mapbox-gl |
<!-- TABLE END -->

### Feature 12 — Coup de Coeur

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | 1 Coup de Coeur par mois pour tous (base). Monnaie sociale rare indexee sur la maturite du spawter. Visible sur la fiche lieu. |
| Justification | La rarete cree la valeur. Un Coup de Coeur = signal social fort. |
| Complexite | S |
<!-- TABLE END -->

Distribution par stade :

<!-- TABLE START -->
| Stade | Base (gratuit) | Bonus Premium | Total Free | Total Gold |
| --- | --- | --- | --- | --- |
| Touriste | 1 | +1 | 1/mois | 2/mois |
| Explorateur | 1 | +1 | 1/mois | 2/mois |
| Detective | 1 | +1 | 1/mois | 2/mois |
| Djidji | 2 | +1 | 2/mois | 3/mois |
| Guide | 3 | +1 | 3/mois | 4/mois |
<!-- TABLE END -->

### Feature 13 — Notifications push basiques

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Notifications locales + push serveur. Max 3-4/semaine. Types : bienvenue, rappel post-visite (avis via systeme VTC), nouveau lieu dans ta zone, activite sur ton avis (reponse), montee de stade, mue d’archetype. |
| Justification | Canal de retention le plus puissant. Les notifications VTC (post-visite) sont le trigger principal de collecte d’avis. |
| Complexite | S |
| Provider | Expo Notifications + FCM/APNs |
<!-- TABLE END -->

### Feature 14 — Paywall geographique

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Gratuit = rayon de 3 km autour du quartier declare. Premium = tout Abidjan. Les lieux hors zone sont affiches mais floutes avec mention « PREMIUM — 2 950 F/mois TTC - Tout Abidjan ». |
| Justification | Le paywall geo EST le ciblage socio-economique. 3 km correspond au rayon de deplacement naturel d’une commune. Au-dela, le pouvoir d’achat justifie le premium. |
| Complexite | M |
| Verification | Geoloc native GPS + verification backend du rayon. Pas de geoloc IP (trop imprecise). Le paywall est un nudge, pas un mur infranchissable. |
<!-- TABLE END -->

### Feature 15 — Paiement Mobile Money

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Integration CinetPay comme agregateur principal. Methodes supportees : Orange Money (P0), Wave (P0), MTN MoMo (P1). Gestion des echecs avec grace period de 7 jours et rappels automatiques. |
| Justification | Le marche cible utilise massivement le Mobile Money (90%+). Le prelevement automatique n’existe pas en Mobile Money — strategie de rappels avec deep link de renouvellement pre-rempli. |
| Complexite | L |
| Provider | CinetPay (ivoirien, agrement BCEAO, support local, frais ~2-3.5%) |
| Architecture | Interface IPaymentProvider abstraite permettant de remplacer CinetPay sans refactoring (ARBITRAGE FONDATEUR) |
<!-- TABLE END -->

### Feature 16 — Partage WhatsApp

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Partager une fiche lieu sur WhatsApp avec deep link vers l’app (ou le store si pas installee). Format : image + nom + note + lien. |
| Justification | WhatsApp est LE canal social en Cote d’Ivoire. Remplace le Mode Crew en V1 : le partage WhatsApp d’une liste curee permet la decision de groupe comme aujourd’hui, mais avec de meilleures options. |
| Complexite | S |
<!-- TABLE END -->

### Feature 17 — Moderation basique

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Signalement d’avis par les spawters (bouton « Signaler ») + moderation manuelle via admin panel. Pas d’IA, pas de systeme complexe. Workflow : signalement → file d’attente → decision humaine (garder/supprimer/warning). |
| Justification | Un seul restaurant victime de trolling et la confiance B2B s’effondre. La moderation est un pre-requis de credibilite. |
| Complexite | M |
| Sanctions | Voir section « Faux-Pas » dans le glossaire |
<!-- TABLE END -->

### Feature 18 — Creation de fiche lieu (par l’equipe)

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | En V1, les lieux sont pre-charges par l’equipe (les 20 de Mission 1 + expansion vers 50-100). Les utilisateurs peuvent suggerer un lieu absent via un formulaire simple (nom, adresse, type). La creation est moderee — pas de fiches creees directement par les users. |
| Justification | Un utilisateur ne doit JAMAIS arriver sur une carte vide. La creation moderee evite les doublons, fiches incompletes et data polluee. |
| Complexite | S |
<!-- TABLE END -->

### Feature 19 — Admin panel basique

<!-- TABLE START -->
| Attribut | Detail |
| --- | --- |
| Description | Interface web d’administration : gestion CRUD des lieux, moderation des avis (file de signalements), gestion des utilisateurs (ban, warning), metriques de base (nb users, nb spawts/jour, nb avis/jour). |
| Justification | L’equipe doit pouvoir operer sans toucher au code. |
| Complexite | M |
| Stack | React + Refine ou AdminJS |
<!-- TABLE END -->

# 4. Features post-MVP

## 4.1 Les 18 features reportees

<!-- TABLE START -->
| # | Feature | Raison du report | Timeline |
| --- | --- | --- | --- |
| 1 | Mode Rapide (Swipe cards) | UX complexe, pas de preuve que le pattern swipe fonctionne pour la food. Un feed + filtres suffit. | V1.5 (M8) |
| 2 | Mode Crew (vote temps reel) | Websockets, sessions synchrones, complexite tech disproportionnee. | V2 (M12) |
| 3 | Mode Explore (magazine scroll) | Layout editorial necessitant du contenu curate en continu. Sans equipe editoriale, c’est un feed vide. | V1.5 (M8) |
| 4 | 8 archetypes supplementaires | Trop de combinaisons pour le MVP. Les 5 MVP couvrent les profils les plus distincts. | V1.5 (M8) |
| 5 | Cartes collectibles / Plats | Feature de retention avancee sans valeur discovery. 4 niveaux de rarete, recto/verso interactif. | V2 (M12) |
| 6 | Matching ML a 4 dimensions | Pas assez de data en V1 pour entrainer un modele. Necessite 10K+ spawts accumules. | V2 (M12+) |
| 7 | Reservation 1-tap | Aucun standard de reservation a Abidjan. Trop de friction B2B pour le MVP. | V2 (M12) |
| 8 | Dashboard B2B Gold | Analytics avances sans data = dashboard vide. | V2 (M12) |
| 9 | Dashboard B2B Pro | Necessite un front separe. Commencer par un rapport email mensuel PDF. | V1.5 (M8) |
| 10 | Badges (30+) | Complexite de design, de tracking, de conditions. Faible ROI en V1. Commencer par 5 badges simples. | V1.5 (M8) |
| 11 | SPAWT Wrapped (bilan annuel) | Besoin de 12 mois de data pour avoir du sens. | V2 (M18) |
| 12 | Podcast | Pas un feature produit. Canal marketing externe. | Jamais dans l’app |
| 13 | Paws (monnaie interne) | Complexite sans valeur visible pour l’utilisateur. | V2 (M12) |
| 14 | Streaks / Leaderboards saisonniers | Phase 2 explicitement dans la Bible. | V2 (M12+) |
| 15 | Share card auto-generee (type Wrapped) | Design generatif, API image, complexite front. | V1.5 (M8) |
| 16 | Multi-villes | La Bible dit « pas avant M12 ». Mais l’architecture DOIT etre prete (design portable). | V2 (M12+) |
| 17 | Site web | Pas prioritaire. Landing page statique suffit pour le SEO/ASO. | V1.5 (M8) |
| 18 | Programme ambassadeur formalise | Programme marketing, pas feature produit. Gere hors app en V1. | V1.5 (M8) |
<!-- TABLE END -->

## 4.2 Roadmap post-MVP

### V1.5 (M8 — environ 2 mois apres le lancement)
- Mode Rapide (swipe cards) si besoin valide
- Mode Explore (magazine scroll) avec UGC suffisant
- 5 badges simples
- 8 archetypes supplementaires (total : 13)
- Dashboard B2B Pro (basique)
- Share card auto-generee
- Programme ambassadeur formalise (3 paliers)
- Landing page web

### V2 (M12 — environ 6 mois apres le lancement)
- Mode Crew (vote temps reel)
- Cartes collectibles / Plats
- Matching ML a 4 dimensions
- Reservation 1-tap
- Dashboard B2B Gold
- Paws (monnaie interne) si marketplace
- Streaks / Leaderboards saisonniers
- Multi-villes (Dakar)
- SPAWT Wrapped (bilan annuel a M18)

# 5. Systeme Le Palais

FORMULE : 2 AXES DOMINANTS x MATURITE COMPORTEMENTALE = TITRE COLLECTIONNABLE

## 5.1 Les 5 axes bipolaires

Chaque spawter est positionne sur 5 axes bipolaires, calibres automatiquement a partir de ses explorations reelles. Echelle : -100 a +100 par axe.

<!-- TABLE START -->
| Axe | Pole gauche (-100) | Pole droit (+100) | Ce que ca mesure |
| --- | --- | --- | --- |
| 1 | Racines | Horizons | Attachement aux saveurs locales vs ouverture internationale |
| 2 | Taniere | Nomade | Fidelite a ses spots vs exploration constante |
| 3 | Exigeant | Enthousiaste | Selectivite critique vs ouverture bienveillante |
| 4 | Foule | Secret | Aime les spots populaires vs prefere les adresses cachees |
| 5 | Maquis | Table | Street food / maquis vs gastronomie / tables dressees |
<!-- TABLE END -->

Les 2 axes les plus marques (valeur absolue la plus elevee) determinent l’archetype.

## 5.2 Les 5 stades de maturite

La maturite mesure le comportement accumule — elle ne recule jamais. La progression est par spots uniquement (nombre de lieux uniques spawtes avec check-in verifie). Pas de systeme de paws en MVP.

<!-- TABLE START -->
| Stade | Seuil | Comportement | Voix du chat |
| --- | --- | --- | --- |
| Touriste | 0-10 spots | Renifle tout. Palais bouge beaucoup. | Enjouee, taquine |
| Explorateur | 11-20 spots | Territoire qui se dessine. Axes se stabilisent. | Complice |
| Detective | 21-30 spots | Sur de son flair. Respecte dans sa zone. Le mot « Chat » entre dans le titre. | Grave, respectueux |
| Djidji | 31-50 spots | Expert reconnu. La colonie ecoute. Mot nouchi signifiant l’expert. | Solennel |
| Guide | 50+ spots | Le chat qui marche devant. Slots limites par ville (3-5 par archetype). | Rare, sacre |
<!-- TABLE END -->

## 5.3 Les 5 archetypes MVP

Decision cle : 5 archetypes pour le MVP (pas 13). Les 5 retenus couvrent les profils les plus distincts. Les 8 restants sont ajoutes en V1.5.

<!-- TABLE START -->
| Archetype | Axes dominants | Esprit | Progression (Touriste -> Guide) |
| --- | --- | --- | --- |
| Pisteur | Nomade + Maquis | Le nez au vent, les pieds dans la poussiere. | Petit Pisteur -> Pisteur -> Pisteur de Brousse -> Pisteur Noir -> La Piste |
| Bouche d’Or | Nomade + Table | Le palais n’a pas de frontieres mais il a des standards. | Bec Fin -> Bouche d’Or -> Bouche d’Or Affutee -> Palais d’Or -> L’Oracle du Gout |
| Gardien du Maquis | Taniere + Maquis | Pourquoi chercher ailleurs quand tu as trouve le bon ? | Habitue -> Gardien du Maquis -> Chat du Comptoir -> Patron d’Ombre -> Le Pilier |
| Vent d’Ailleurs | Horizons + Nomade | Chaque assiette est un billet d’avion. | Brise -> Vent d’Ailleurs -> Chat du Monde -> Courant -> Le Monde |
| Omnivore | Equilibre (aucun axe dominant) | Mange tout. Juge tout. N’appartient a aucune case. Accessible a partir du stade Explorateur. | — -> Omnivore -> Chat Errant -> Cameleon -> L’Inclassable |
<!-- TABLE END -->

Les 8 archetypes ajoutes en V1.5 : Fantome, Memoire, Feu de Braise, Oeil de Chat, Murmure, Lame, Passeport Dore, Ancre.

## 5.4 La collection de titres
- Permanent. Chaque titre obtenu reste dans la collection pour toujours.
- Choix d’affichage. Le titre « actuel » est calcule automatiquement. Le titre « affiche » est au choix du spawter.
- Double affichage. Si le titre affiche est different du titre actuel, le profil montre les deux.
- Evenement. Chaque montee de stade ou mue ajoute un titre. Moment celebre avec ecran dedie.
- Rarete Guide. Les titres Guide sont les seuls limites par ville (3-5 slots par archetype).

## 5.5 La mue et les transitions

<!-- TABLE START -->
|  | Montee de stade (verticale) | Mue d’archetype (laterale) |
| --- | --- | --- |
| Ton du chat | Celebration enthousiaste | Constat neutre (pas promotion ni retrogradation) |
| Declencheur | Seuil de spots atteint | Axes dominants stables sur 30 jours + 5 spots minimum |
| Exemple | « 40 spots. Tu passes Detective. Chat Fantome. » | « Je te sens different. Tes 30 derniers spots disent Fantome plus que Pisteur. » |
| Impact | Nouveau titre ajoute + ecran de celebration | Nouveau titre ajoute + notification du chat |
<!-- TABLE END -->

Regle d’inertie : l’archetype ne switch que si les axes dominants sont stables sur 30 jours + 5 spots minimum dans la nouvelle direction. Pas de flip-flop hebdomadaire.

## 5.6 Calibrage du Palais

### Calibrage initial (onboarding)

5 questions, une par axe, generant des scores entre -40 et +40.

### Mise a jour continue

A chaque check-in, decroissance exponentielle — les actions recentes pesent plus que les anciennes :

facteur_apprentissage = max(0.05, 1.0 / (1 + n_spots * 0.05))
delta = signal * facteur_apprentissage
nouveau_score = clamp(ancien_score + delta, -100, +100)

<!-- TABLE START -->
| Spots uniques | Facteur | Impact d’un signal +2 |
| --- | --- | --- |
| 1 | 0.95 | +1.90 (Palais tres instable) |
| 10 | 0.67 | +1.33 |
| 20 | 0.50 | +1.00 |
| 50 | 0.29 | +0.57 (Palais ancre) |
<!-- TABLE END -->

## 5.7 Honnetete par couches

<!-- TABLE START -->
| Couche | Audience | Ton | Exemple |
| --- | --- | --- | --- |
| Nom / Titre | Social (profil public) | Emotionnel, cool, memorable | « Pisteur Noir » |
| Palais Radar | Personnel (optionnel) | Analytique, 5 axes avec valeurs | Les axes en visualisation radar |
| Voix du Chat | Intime (dans l’app) | Transparent, contextualise | « 12 spots, ton Palais se dessine encore. » |
<!-- TABLE END -->

# 6. ADN du Lieu

## 6.1 Les 5 axes du lieu

Chaque lieu possede un profil multidimensionnel appele « ADN du Lieu » ou « Terroir », construit organiquement par les avis et comportements des spawters. Le restaurateur ne le controle pas directement.

<!-- TABLE START -->
| Axe | Pole gauche (-100) | Pole droit (+100) | Ce que ca mesure |
| --- | --- | --- | --- |
| 1 | Local | International | Cuisine d’ici vs cuisine du monde |
| 2 | Informel | Etabli | Maquis de rue vs restaurant structure |
| 3 | Budget | Premium | Accessibilite financiere |
| 4 | Populaire | Prive | Notoriete large vs adresse cachee |
| 5 | Decontracte | Habille | Ambiance relax vs setting soigne |
<!-- TABLE END -->

Minimum viable : un lieu avec <5 avis n’a pas d’ADN fiable. Afficher « ADN en construction » plutot qu’un radar faux.

## 6.2 Calcul de l’ADN

L’ADN est calcule a partir des avis (pas des check-ins simples). Un check-in sans avis ne modifie pas l’ADN. Les sous-criteres de l’avis (cuisine, ambiance, service, rapport qualite-prix) et les tags rapides sont mappes vers les axes de l’ADN.

Le confidence_score (0 a 1) indique la fiabilite de l’ADN en fonction du nombre d’avis recus.

## 6.3 Badges / Signaux speciaux du lieu

<!-- TABLE START -->
| Signal | Condition | Signification |
| --- | --- | --- |
| Coup de Coeur | X Coups de Coeur recus ce mois | Coup de coeur collectif de la communaute |
| Pepite Verifiee | 3+ experts (Djidji/Guide) ont confirme | Les connaisseurs valident |
| Institution | Note >=4.5 stable +12 mois, 50+ avis | Un classique qui ne decoit jamais |
| Fidelite | Taux de retour spawters >30% | Les gens reviennent — signe fort |
| Decouverte | 0->20 spawts en 30 jours | Nouveau lieu en montee fulgurante |
| Table Diverse | Attire 5+ archetypes differents | Lieu universel |
| Noctambule Verifie | Confirme ouvert tard par 10+ spawters | Info pratique validee par la communaute |
<!-- TABLE END -->

# 7. Les 3 interactions utilisateur

Trois actions essentielles, et uniquement trois. Toute mecanique additionnelle doit se justifier par rapport a ce socle.

## 7.1 Action 1 : Le Spawt (Check-in)

Le spawter confirme sa presence dans un lieu. Action rapide, instinctive. Brique de base de la data — chaque spawt nourrit le Palais du spawter et l’ADN du lieu.

Mecanisme MVP (type VTC) : - Perimetre de detection : 10 metres du lieu - Timer d’attente : 15 minutes apres detection d’entree - Fenetre de notation : active pendant toute la presence + 30 minutes apres la sortie - Snooze : reportable de 15 minutes, max 3 fois - Declencheur de sortie : notification forcee quand le spawter quitte la zone - Check-in passif : si aucune reponse, le spawt est enregistre sans note (poids 0.5x)

Duree cible : < 30 secondes pour un spawt simple, < 2 minutes avec avis.

## 7.2 Action 2 : L’Avis Qualitatif

Plus qu’une note, c’est un temoignage structure. Le poids algorithmique depend du stade du spawter. Les avis des Djidji et Guide sont marques « Fiable » ou « Tres fiable ».

Structure : - Note etoiles 1-5 (obligatoire si avis) - Tags rapides : « Copieux », « Rapide », « Ambiance top », « Cher », « A refaire » (selection multiple) - Texte libre (optionnel, max 500 caracteres) - Photos (optionnelles, max 3)

Notation ponderee : - Le stade du spawter affecte le poids algorithmique de son avis - Les avis recents pesent plus que les anciens - La note affichee est la note ponderee

## 7.3 Action 3 : Le Coup de Coeur

Monnaie sociale rare. Le nombre de Coups de Coeur disponibles est indexe sur la maturite, pas sur le portefeuille. Un Coup de Coeur est un signal social fort qui impacte la visibilite et le ranking du lieu.

# 8. Matching instinctif

## 8.1 Formule composite MVP

Score_matching(user, place) =
    0.15 * cosine_similarity(user.palais_vector, place.adn_vector)
  + 0.30 * distance_penalty(user.location, place.location)
  + 0.30 * note_ponderee(place)
  + 0.10 * recency_boost(place)
  + 0.15 * novelty_bonus(user, place)

## 8.2 Detail des dimensions

<!-- TABLE START -->
| Dimension | Poids MVP | Calcul | Justification |
| --- | --- | --- | --- |
| Palais x ADN (cosine similarity) | 0.15 | Similarite cosinus entre les 5 axes du Palais et les 5 axes de l’ADN, normalisee en [0, 1] | Poids faible en MVP car les profils sont peu fiables avec peu de data. Augmenter progressivement quand le confidence_score monte. |
| Distance | 0.30 | Penalite non lineaire : 0-1km = 0, 1-3km = legere, 3-5km = forte, 5km+ = tres forte (+ paywall) | La proximite est le premier critere de decision a Abidjan |
| Note ponderee | 0.30 | Note communautaire ponderee par stade des votants : Touriste 1x, Explorateur 1.5x, Detective 2x, Djidji 2.5x, Guide 3x | Qualite communautaire validee |
| Recency | 0.10 | Bonus pour les lieux recemment spawtes (activite fraiche) | Favorise les lieux actifs |
| Novelty | 0.15 | Bonus si l’utilisateur n’y est jamais alle | Encourage l’exploration |
<!-- TABLE END -->

## 8.3 Score affiche

Le score est affiche en pourcentage sur la fiche lieu. Plage affichee : 50% a 99% (on evite les scores < 50% qui n’apportent rien).

score_affiche = 50 + (score_final * 49)

## 8.4 Evolution vers le ML (V2)

Le MVP stocke TOUS les signaux utilisateur (spawts, avis, vues, sauvegardes, partages, recherches, filtres, clics, dismissals) dans une table append-only user_signals. C’est la matiere premiere du ML futur. Cout de stockage negligeable. Cout de migration si oublie : enorme.

En V2, ajouter les dimensions colonie (profils similaires) et contexte avance (meteo, evenements, historique temporel).

# 9. Experience utilisateur

## 9.1 Mode principal MVP

Le MVP utilise un seul mode : un feed personnalise (liste) + carte + recherche/filtres. Les 3 modes contextuels de la Bible (Rapide/Crew/Explore) sont reportes.
- Pas de Mode Crew en V1. Le Crew est remplace par le partage WhatsApp d’une liste curee.
- Pas de Mode Rapide (swipe) en V1. Le feed ordonne avec filtres suffit.
- Pas de Mode Explore (magazine) en V1. Necessite du contenu editorial.

## 9.2 Navigation — Barre de navigation

<!-- TABLE START -->
| Position | Icone | Label | Description |
| --- | --- | --- | --- |
| Gauche | Maison | Accueil | Feed personnalise |
| Centre-gauche | Loupe | Chercher | Recherche + filtres |
| Centre (sureleve) | Empreinte | Spawter | Bouton de check-in principal (CTA) |
| Centre-droit | Carte | Carte | Vue carte interactive |
| Droite | Profil | Moi | Profil utilisateur, Palais, collection, favoris |
<!-- TABLE END -->

## 9.3 Voix du chat

Le chat SPAWT est omnipresent. Il parle en dialecte SPAWT. Sa voix evolue avec la maturite du spawter :

<!-- TABLE START -->
| Stade | Ton | Exemple |
| --- | --- | --- |
| Touriste | Enjoue, taquin | « Bienvenue. Ton Palais est vierge. Chaque spawt le dessine un peu plus. On y va ? » |
| Explorateur | Complice | « 11 spots. Ton nez s’affine. Je commence a te reconnaitre. » |
| Detective | Grave, respectueux | « Le Chat te salue. Ton flair ne ment plus. » |
| Djidji | Solennel | « Plus besoin de te guider. Tu ES le guide. La tribu ecoute. » |
| Guide | Silencieux | (silence + animation speciale) |
<!-- TABLE END -->

## 9.4 Paywall visuel

Les spots hors zone (>3 km) sont affiches mais floutes avec mention : « PREMIUM — 2 950 F/mois TTC - Tout Abidjan ».

## 9.5 Signaux sociaux sur les fiches
- « Pepite Verifiee » : badge vert
- « Institution » : badge or
- Score de matching en pourcentage
- Nombre de spawts et d’avis
- Stade du spawter (label textuel) a cote de ses avis

# 10. Systeme de badges et progression

## 10.1 Distinction fondamentale : Titre vs Badge

<!-- TABLE START -->
|  | Titre | Badge |
| --- | --- | --- |
| Nature | Qui tu ES | Ce que tu AS FAIT |
| Calcul | Automatique (Palais x Maturite) | Conditions specifiques remplies |
| Permanence | Mue possible (peut changer) | Permanent (s’accumule) |
| Affichage | 1 seul affiche (choisi) | Jusqu’a 3 affiches (choisis) |
| Exemple | Pisteur Noir | Noctambule + Chasseur de Pepites |
<!-- TABLE END -->

## 10.2 Badges MVP (5 badges simples)

Les 5 badges du MVP couvrent les fonctions business essentielles :

<!-- TABLE START -->
| Badge | Condition | Fonction business |
| --- | --- | --- |
| Traversee | Spawts dans 5 communes differentes | ACTIVER — encourage l’exploration |
| Noctambule | 10 spawts apres 21h | RETENIR — cree une habitude |
| Chasseur de Pepites | 10 lieux avec moins de 10 avis existants | VIRALISER — les decouveurs attirent les curieux |
| Palais Diversifie | Spawts dans 5+ types de cuisine | CREDIBILISER — prouve la diversite |
| Eclaireur | Un de tes avis sauvegarde 10 fois | CONVERTIR — genere de la social proof |
<!-- TABLE END -->

## 10.3 Les 5 fonctions business de chaque badge

<!-- TABLE START -->
| Fonction | Objectif | Mecanique |
| --- | --- | --- |
| ACTIVER | 40% -> 65% activation | Badge « Premier Spawt » = verrou. Pas d’acces aux avis detailles sans premier spawt. |
| CREDIBILISER | Poids avis, data B2B | Le stade du spawter apparait comme label textuel. |
| CONVERTIR | 5% -> 8% premium | Feature gating par stade. « Tu es Explorateur. Passe Detective pour les food tours. » |
| VIRALISER | Coefficient viral 1.4x | Partage WhatsApp avec deep link. |
| RETENIR | M6: 25% retention | Djidji/Guide = role avec responsabilites. |
<!-- TABLE END -->

## 10.4 Badges Phase 2 (V1.5+)

30+ badges thematiques repartis en 3 categories : - Exploration : Pionnier de [Commune], Leve-Tot, Marathon Maquis, Cartographe - Expertise : Gardien du Garba, Ambassadeur [Cuisine], Oeil de Braise, Calibre - Influence : Aimant, Meneur de Crew, Bouche a Oreille, Faiseur de Pluie, Voix de la Colonie

# 11. Monetisation

## 11.1 Strategie V1 : B2C uniquement

Decision cle : B2C only en V1. B2B a partir de V1.5. Se concentrer sur la traction B2C. Le B2B Pro (fiche revendiquee) peut etre un process manuel hors-app en V1.

## 11.2 Premium B2C — Spawter Gold

<!-- TABLE START -->
|  | Spawter (Gratuit) | Spawter Gold (Premium) |
| --- | --- | --- |
| Prix | 0 FCFA | 2 500 FCFA HT/mois (2 950 F TTC) - 25 000 FCFA HT/an (29 500 F TTC) |
| Decouverte | Dans ta commune (~3 km) | Tout Abidjan deverrouille |
| Contenu | 60% (avis, photos, ADN) | 100% + avis detailles |
| Palais | Basique (2 axes visibles) | Complet (5 axes + historique) |
| Coups de Coeur | Selon maturite | Selon maturite + 1 bonus |
| Badge | Standard | Badge dore sur le profil |
| Listes curatees | Limitees | Illimitees |
| Analytics perso | Non | Ton Palais dans le temps |
<!-- TABLE END -->

Prix annuel corrige : 25 000 FCFA HT (pas 24 000) — 2 mois offerts.

Affichage in-app (B2C) : prix TTC. En Cote d’Ivoire, les consommateurs finaux raisonnent en prix final.

## 11.3 Tiers B2B (a partir de V1.5)

### Spawt Libre — 0 FCFA (par defaut)

Fiche lieu creee par les spawters. ADN auto-calcule. Etoiles et avis visibles. Recommandations organiques.

### Spawt Pro — 15 000 FCFA HT/mois (17 700 F TTC)

Badge Verifie, Repondre aux avis, Le Carnet (espace editorial), Dashboard basique, 1 photo officielle mise en avant.

Bridge digital : pour les spots peu digitalises (type Tantie Rose), un Allie SPAWT (community manager quartier) gere 5-10 fiches Pro.

### Spawt Gold — 65 000 FCFA HT/mois (76 700 F TTC)

Visibilite contextuelle, Analytics avances (profil Palais clientele vs zone), Tendances, Ciblage par archetype, Evenements exclusifs, Benchmark anonymise, Insights personnalises.

## 11.4 Gestion des abonnements recurrents

Le Mobile Money ne supporte pas le prelevement automatique natif. Strategie de rappels :

<!-- TABLE START -->
| Etape | Action | Delai |
| --- | --- | --- |
| Rappel pre-echeance | Notification push + SMS | J-3 |
| Rappel jour J | Notification push avec deep link de paiement pre-rempli | J |
| Grace period | Acces maintenu avec bandeau « Ton Gold expire. Renouvelle. » | J+0 a J+7 |
| Downgrade automatique | Retour au gratuit. Donnees premium conservees 90 jours mais masquees. | J+8 |
| Re-souscription | Restauration immediate de toutes les donnees premium | Immediat |
<!-- TABLE END -->

## 11.5 Unit Economics & Projections M12

<!-- TABLE START -->
| Source | Prix HT | Cible M12 | Projection mensuelle |
| --- | --- | --- | --- |
| B2C Premium | 2 500 FCFA/mois | 500 spawters Gold | 1,25M FCFA/mois |
| B2B Pro | 15 000 FCFA/mois | 50 restos Pro | 750K FCFA/mois |
| B2B Gold | 65 000 FCFA/mois | 10 restos Gold | 500K-1M FCFA/mois |
<!-- TABLE END -->

ARR Potentiel M12 : ~30M FCFA (~45 000 EUR).

# 12. Architecture technique

## 12.1 Stack technique

<!-- TABLE START -->
| Composant | Choix | Justification |
| --- | --- | --- |
| Frontend mobile | React Native + Expo SDK 52+ + Expo Router + NativeWind | Talent pool JS/React en CI, Expo Updates (OTA), time-to-market |
| Backend | Supabase (PostgreSQL managee + Auth + Storage + Edge Functions) | Prototypage rapide, auth integree, realtime, migration possible vers custom |
| Base de donnees | PostgreSQL (via Supabase) | Relationnel, extensions JSONB, pgvector futur pour ML |
| Cartes | Mapbox GL via react-native-mapbox-gl | Cout moindre que Google Maps, style dark customisable, donnees OSM correctes pour Abidjan |
| Paiement | CinetPay (agregateur) | Ivoirien, supporte Orange Money + Wave + MTN MoMo, agrement BCEAO, frais ~2-3.5% |
| Stockage images | Cloudinary | Compression automatique, CDN, lazy loading. Max 3 photos/avis, 5 photos/lieu. Compression 80%, max 1MB/image. |
| State management | Zustand ou TanStack Query | Zustand pour le state local, TanStack Query pour le server state |
| Analytics | Mixpanel ou PostHog | Suivi du funnel AARRR, events, cohortes |
| Push | Expo Notifications + FCM/APNs | Notifications locales (VTC) + push serveur |
| CI/CD | EAS Build (Expo) + GitHub Actions | Build cloud, deploi OTA |
| Admin panel | React + Refine ou AdminJS | Simple, rapide, CRUD |
| Monitoring | Sentry + Supabase Dashboard | Crash reporting, metriques backend |
| Auth OTP | Twilio ou Termii | SMS OTP, provider local pour Termii |
<!-- TABLE END -->

## 12.2 Structure du projet — Monorepo

spawt/
  app/                    # React Native + Expo (mobile)
  api/                    # Backend (Supabase Edge Functions ou Node.js)
  admin/                  # Panel admin (React + Refine)
  shared/                 # Types TypeScript, utils, constantes partagees
  src/
    theme/
      tokens.ts           # SOURCE UNIQUE de toutes les couleurs/typos
      tokens.css           # Genere depuis tokens.ts
      tokens.json          # Export pour Figma
      ThemeProvider.tsx     # Context React Native
      useTheme.ts          # Hook
      themes/
        default.ts         # Theme standard
        dark.ts            # Phase 2 — prepare mais pas active

## 12.3 Architecture du paiement — Interface abstraite

Le provider de paiement est abstrait derriere une interface IPaymentProvider (ARBITRAGE FONDATEUR). CinetPay est le provider actuel mais DOIT pouvoir etre remplace sans refactoring majeur.

interface IPaymentProvider {
  readonly name: string;
  initiate(params: PaymentInitiateParams): Promise<PaymentResult>;
  getStatus(transactionId: string): Promise<PaymentConfirmation>;
  confirm(transactionId: string): Promise<PaymentConfirmation>;
  refund(params: RefundParams): Promise<RefundResult>;
  parseWebhook(payload: WebhookPayload): Promise<PaymentConfirmation>;
}

# 13. Modeles de donnees

## 13.1 Table user_palais — Profil gustatif du spawter

CREATE TABLE user_palais (
    user_id                     UUID PRIMARY KEY REFERENCES users(id),
    axe_racines_horizons        FLOAT DEFAULT 0,   -- [-1, 1] (stocke normalise)
    axe_taniere_nomade          FLOAT DEFAULT 0,
    axe_exigeant_enthousiaste   FLOAT DEFAULT 0,
    axe_foule_secret            FLOAT DEFAULT 0,
    axe_maquis_table            FLOAT DEFAULT 0,
    confidence_score            FLOAT DEFAULT 0,   -- [0, 1] fiabilite du Palais
    dominant_axes               JSONB,             -- Les 2 axes les plus marques
    archetype_id                VARCHAR(30),       -- archetype derive
    stade                       VARCHAR(20),       -- touriste/explorateur/detective/djidji/guide
    total_spawts                INT DEFAULT 0,
    updated_at                  TIMESTAMP
);

Points critiques : - Les axes sont des FLOAT bipolaires [-1, 1] pour le calcul de distance vectorielle avec l’ADN - Le confidence_score est essentiel : un Palais avec 2 spawts n’a pas la meme fiabilite qu’un Palais avec 50 - Les dominant_axes sont caches en JSONB pour eviter un recalcul a chaque affichage - Recalcul incremental a chaque spawt (pas from scratch)

## 13.2 Table place_adn — Profil du lieu

CREATE TABLE place_adn (
    place_id                    UUID PRIMARY KEY REFERENCES places(id),
    axe_local_international     FLOAT DEFAULT 0,   -- [-1, 1]
    axe_informel_etabli         FLOAT DEFAULT 0,
    axe_budget_premium          FLOAT DEFAULT 0,
    axe_populaire_prive         FLOAT DEFAULT 0,
    axe_decontracte_habille     FLOAT DEFAULT 0,
    confidence_score            FLOAT DEFAULT 0,   -- [0, 1]
    total_reviews               INT DEFAULT 0,
    updated_at                  TIMESTAMP
);

Points critiques : - L’ADN est calcule a partir des AVIS (pas des check-ins simples) - Un lieu avec <5 avis n’a pas d’ADN fiable → afficher « ADN en construction »

## 13.3 Table user_signals — Collecte pour ML futur

CREATE TABLE user_signals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    signal_type VARCHAR(20) NOT NULL,
    -- Types : spawt, review, view, save, share, search, filter, click, dismiss
    place_id    UUID,
    metadata    JSONB,   -- contexte : heure, jour, position, device, session_id
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_signals_user ON user_signals(user_id, created_at);
CREATE INDEX idx_signals_type ON user_signals(signal_type);

Ce tableau ne sert pas en V1 mais il est CRITIQUE de le creer des le debut. Cout de stockage negligeable. Cout de migration si oublie : enorme.

## 13.4 Table spawter_progression

CREATE TABLE spawter_progression (
    spawter_id          UUID PRIMARY KEY REFERENCES users(id),
    stade_actuel        VARCHAR(20),  -- touriste/explorateur/detective/djidji/guide
    archetype_actuel    VARCHAR(30),
    titre_actuel        VARCHAR(60),
    titre_affiche       VARCHAR(60),  -- peut != titre_actuel
    spots_uniques       INTEGER DEFAULT 0,
    date_dernier_stade  TIMESTAMP,
    updated_at          TIMESTAMP
);

## 13.5 Table collection_titres

CREATE TABLE collection_titres (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spawter_id          UUID REFERENCES users(id),
    titre               VARCHAR(60),
    stade               VARCHAR(20),
    archetype           VARCHAR(30),
    type_obtention      VARCHAR(20),  -- montee_stade, mue, onboarding
    spots_au_moment     INTEGER,
    date_obtenu         TIMESTAMP,
    is_displayed        BOOLEAN DEFAULT FALSE
);

## 13.6 Table mue_tracking

CREATE TABLE mue_tracking (
    spawter_id          UUID PRIMARY KEY REFERENCES users(id),
    archetype_candidat  VARCHAR(30),
    date_debut          TIMESTAMP,
    spots_dans_direction INTEGER DEFAULT 0,
    dernier_check       TIMESTAMP
);

## 13.7 Table spawt_checkin

CREATE TABLE spawt_checkin (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spawter_id          UUID NOT NULL REFERENCES users(id),
    lieu_id             UUID NOT NULL REFERENCES places(id),
    arrived_at          TIMESTAMP,
    notified_at         TIMESTAMP,
    snoozed_at          TIMESTAMP,
    snooze_count        SMALLINT DEFAULT 0,
    checked_in_at       TIMESTAMP,
    left_at             TIMESTAMP,
    check_in_type       VARCHAR(20) DEFAULT 'active',
    -- active / passive / manual
    session_duration_minutes INT,
    geolocation_lat     FLOAT,
    geolocation_lng     FLOAT,
    accuracy_meters     FLOAT,
    geolocation_source  VARCHAR(10),  -- gps / network / manual
    distance_to_lieu_meters FLOAT,
    is_verified         BOOLEAN DEFAULT FALSE,
    note_etoiles        SMALLINT,
    texte_avis          TEXT,
    tags                TEXT[],
    photos              TEXT[],
    is_cancelled        BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP
);

CREATE INDEX idx_checkin_spawter ON spawt_checkin(spawter_id, created_at);
CREATE INDEX idx_checkin_lieu ON spawt_checkin(lieu_id, created_at);
CREATE INDEX idx_checkin_type ON spawt_checkin(check_in_type);

## 13.8 Table subscriptions et invoices

CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL,
    customer_type   VARCHAR(10) NOT NULL,  -- b2c / b2b
    plan            VARCHAR(20) NOT NULL,  -- gold_monthly / gold_annual / pro / b2b_gold
    price_ht        INTEGER NOT NULL,      -- en FCFA
    tva_rate        DECIMAL(4,2) DEFAULT 18.00,
    currency        VARCHAR(3) DEFAULT 'XOF',
    status          VARCHAR(20) DEFAULT 'active',
    started_at      TIMESTAMP,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  VARCHAR(20) NOT NULL UNIQUE,  -- SPAWT-2026-0001
    subscription_id UUID REFERENCES subscriptions(id),
    customer_id     UUID NOT NULL,
    customer_type   VARCHAR(10) NOT NULL,
    price_ht        INTEGER NOT NULL,
    tva_rate        DECIMAL(4,2) NOT NULL DEFAULT 18.00,
    tva_amount      INTEGER NOT NULL,
    price_ttc       INTEGER NOT NULL,
    currency        VARCHAR(3) DEFAULT 'XOF',
    status          VARCHAR(20) DEFAULT 'draft',
    issued_at       TIMESTAMP,
    paid_at         TIMESTAMP,
    pdf_url         VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW()
);

# 14. Contraintes et risques

## 14.1 Contraintes techniques

<!-- TABLE START -->
| Contrainte | Detail | Mitigation |
| --- | --- | --- |
| Connectivite intermittente | Le reseau 3G/4G est instable dans certaines zones d’Abidjan. | Les notifications de check-in sont locales (fonctionnent sans reseau). Les check-ins sont stockes localement et synchronises au retour du reseau. Mode offline prevu en Phase 2. |
| GPS imprecis en interieur | Precision GPS variable, surtout dans les maquis couverts ou les centres commerciaux. | Moyenne des 3 dernieres positions sur 30 secondes. Si accuracy >30m, basculer en check-in manuel. |
| Batterie | Le monitoring GPS consomme de la batterie. | Geofencing natif (basse consommation en background). Si batterie <10%, desactiver le monitoring et passer en mode manuel. |
| App tuee par l’OS (Android) | Les constructeurs Android (Tecno, Infinix, Samsung) tuent agressivement les apps en background. | Les geofences persistent au niveau OS. Latence possible de quelques minutes. Documenter les parametres batterie pour les users. |
| Taille de l’app | Les smartphones d’entree de gamme ont un stockage limite (16-32 Go). | Viser un APK < 50 Mo. Compression agressive des images. Pas de ressources lourdes embarquees. |
<!-- TABLE END -->

## 14.2 Contraintes marche

<!-- TABLE START -->
| Contrainte | Detail | Mitigation |
| --- | --- | --- |
| Mobile Money = pas de prelevement automatique | Aucun operateur ne supporte le debit recurrent sans validation manuelle. | Strategie de rappels push + SMS + grace period 7 jours. Deep link de renouvellement pre-rempli. |
| Fracture digitale restaurateurs | Tantie Rose n’a pas de smartphone. Les maquis de quartier ne gereront pas une fiche. | Bridge digital : Allie SPAWT (community manager quartier) gere 5-10 fiches. Les fiches sont creees par la communaute, pas par les restaurateurs. |
| Absence de standard d’adresse | Pas de systeme d’adresse structure a Abidjan (pas de code postal fiable). | Geolocalisation GPS comme reference. Adresses descriptives (« en face de la pharmacie X, apres le carrefour Y »). |
| TVA 18% | Les prix doivent inclure la TVA pour le B2C. | Affichage TTC en B2C, HT en B2B. Declaration TVA mensuelle a la DGI. |
<!-- TABLE END -->

## 14.3 Risques produit

<!-- TABLE START -->
| Risque | Probabilite | Impact | Mitigation |
| --- | --- | --- | --- |
| Cold start : carte vide au lancement | Elevee | Critique | Pre-charger 50-100 lieux. Mission 1 = 20 restaurants onboardes. |
| Spawts frauduleux | Moyenne | Eleve | Systeme anti-fraude a 6 regles (voir Annexe 20.4). Perimetre 10m + timer 15 min. |
| Palais imprecis au debut | Elevee | Moyen | Confidence score. « ADN en construction ». Poids faible du Palais dans le matching MVP (0.15). |
| Faible adoption premium | Moyenne | Eleve | Paywall geographique comme nudge naturel. Trial 7 jours a J+14. Feature gating par stade. |
| Churn Mobile Money | Elevee | Eleve | Grace period 7 jours. Rappels multi-canal. Donnees conservees 90 jours post-downgrade. |
| Concurrence Google Maps | Faible | Moyen | Google Maps ne fait pas de recommandation personnalisee. Differenciation par l’identite (Palais, archetypes, communaute). |
| Moderation insuffisante | Moyenne | Eleve | Moderation manuelle en V1. Recrutement d’un moderateur communautaire. |
<!-- TABLE END -->

## 14.4 Risques techniques

<!-- TABLE START -->
| Risque | Impact | Mitigation |
| --- | --- | --- |
| CinetPay down / instable | Blocage monetisation | Interface IPaymentProvider abstraite. Provider de backup identifie (Flutterwave). |
| Supabase limites de scaling | Performance degradee | Monitoring proactif. Plan de migration vers Node.js + PostgreSQL custom si necessaire. |
| Mapbox couts inattendus | Depassement budget | Monitoring des loads. Cache agressif des tiles. Limiter les appels API. |
<!-- TABLE END -->

# 15. Direction artistique

## 15.1 Palette de couleurs definitive

ARBITRAGE FONDATEUR : Palette finale retenue.

<!-- TABLE START -->
| Couleur | Code hex | Usage | Justification |
| --- | --- | --- | --- |
| Noir | #0A0A0A | Base, backgrounds sombres, texte principal | Luxe accessible, nocturne |
| Or SPAWT | #D4AF37 | Couleur premium principale, badges dores, accent | Or classique brillant — resonance bijou ouest-africain |
| Vert Chat | #50C878 | CTAs, validations, elements actifs, mascotte | Vert emeraude vif — yeux du chat |
| Blanc casse | #F8F6F0 | Fond principal clair | Chaleureux, lisible |
<!-- TABLE END -->

Contrainte architecture : Les couleurs DOIVENT etre modifiables sans toucher au code — uniquement via un fichier de tokens/variables (src/theme/tokens.ts).

## 15.2 Systeme de couleurs etendu

<!-- TABLE START -->
| Token | Hex | Usage |
| --- | --- | --- |
| color-brand-primary | #D4AF37 | Or SPAWT |
| color-brand-accent | #50C878 | Vert Chat — CTAs |
| color-surface-base | #F8F6F0 | Fond principal |
| color-surface-inverse | #0A0A0A | Fond sombre |
| color-text-primary | #0A0A0A | Texte principal |
| color-text-inverse | #F8F6F0 | Texte sur fond sombre |
| color-semantic-success | #50C878 | Validation |
| color-semantic-error | #C43D3D | Erreur |
| color-premium-badge | #D4AF37 | Badge dore |
<!-- TABLE END -->

## 15.3 Typographies

<!-- TABLE START -->
| Usage | Police | Justification |
| --- | --- | --- |
| Titres (display) | Instrument Serif | Elegance editoriale |
| Corps (body) | Manrope | Lisibilite mobile optimale |
| Donnees (data) | JetBrains Mono | Precision des chiffres (scores, stats) |
<!-- TABLE END -->

## 15.4 Mascotte

Le Chat SPAWT. Pas un chatbot. Un felin. Il se balade sur la carte. Il flaire les bons spots. Il ne suit pas, il guide. Il ne juge pas, il observe.

Posture de la marque : independance curieuse, discretion, nez fin. Le chat ne crie pas. Il murmure. Il ne vend pas. Il suggere.

Nom du chat : a definir (process de naming interne ou communautaire — decision en attente).

## 15.5 Ton de la marque
- Traits : Foodie Pro Max, Tech-savvy, Simplicite, Humour exclusif (insider jokes)
- Principes : Ni bullshit, Ni diplomatie + Direct mais jamais mechant + Expert sans pretention + Fun sans etre lourd
- Ne dit jamais : « Gastronomie » (trop pompeux), Grossierete, « Solutions innovantes », « Disruptif »
- Dit toujours : « Spawte », « Ton crew » / « La meute », « En moins de [X] », « Spawt Certifie », « Ton chat a trouve »

## 15.6 Mode sombre

NON pour le MVP. La palette est deja construite autour du noir (#0A0A0A). L’architecture tokens est prete pour un theme sombre en Phase 2.

# 16. KPIs et metriques

## 16.1 Funnel AARRR — B2C

### Acquisition

<!-- TABLE START -->
| Metrique | Objectif M3 | Objectif M6 | Objectif M12 |
| --- | --- | --- | --- |
| Downloads/mois | 2K | 10K | 25K |
| CAC | < 2 000 FCFA | < 2 000 FCFA | < 2 000 FCFA |
| Sources | Organic 40%, Referral 25%, Paid 15%, Other 20% |  |  |
<!-- TABLE END -->

### Activation

<!-- TABLE START -->
| Metrique | Objectif |
| --- | --- |
| Download → Ouvre app | 85% |
| Ouvre app → Onboarding complete | 70% |
| Onboarding → Clique 1er lieu | 50% |
| Clique → 1er Spawt | 40% |
| Activation J+7 | 60% |
<!-- TABLE END -->

### Retention

<!-- TABLE START -->
| Metrique | Objectif |
| --- | --- |
| Retention M1 | 50% |
| Retention M3 | 35% |
| Retention M6 | 25% |
| Retention M12 | 20% |
| Sessions/semaine | 3.5 |
| Duree session | 7 min |
<!-- TABLE END -->

### Referral

<!-- TABLE START -->
| Metrique | Objectif |
| --- | --- |
| % users qui referent 1+ personne | 30% |
| Coefficient viral | 1.4 |
| Conversion referrals | 25% |
<!-- TABLE END -->

### Revenue

<!-- TABLE START -->
| Metrique | Objectif M6 | Objectif M12 |
| --- | --- | --- |
| Conversion premium | 5% | 8% |
| Churn premium/mois | < 5% | < 5% |
| ARPU | 2 200 FCFA/mois | 2 500 FCFA/mois |
| LTV/CAC | > 3.5x | > 3.5x |
<!-- TABLE END -->

## 16.2 Funnel AARRR — B2B (a partir de V1.5)

<!-- TABLE START -->
| Etape | Objectif |
| --- | --- |
| Acquisition | 15-20 Pro/mois, 3-5 Featured/mois |
| Activation | 80% profil optimise M1 |
| Retention | Churn Pro <10%/an, Gold <5% |
| Referral | 20% referrent 1+ pair |
| Revenue | MRR Growth +15-20%/mois |
<!-- TABLE END -->

## 16.3 KPIs Dashboard

<!-- TABLE START -->
| Metrique | M3 | M6 | M12 |
| --- | --- | --- | --- |
| MAU | 1K | 5K | 15K |
| Downloads cumules | 5K | 30K | 100K |
| Lieux dans la base | 100 | 300 | 800 |
| Spawts/jour | 50 | 200 | 500 |
| Avis/jour | 20 | 80 | 200 |
| Premium subscribers | 50 | 250 | 500 |
| MRR B2C | 125K FCFA | 625K FCFA | 1.25M FCFA |
<!-- TABLE END -->

## 16.4 Distribution cible des stades a M12

<!-- TABLE START -->
| Stade | % des users actifs |
| --- | --- |
| Touriste | 40% |
| Explorateur | 35% |
| Detective | 15% |
| Djidji | 8% |
| Guide | 2% |
<!-- TABLE END -->

# 17. Plan de livraison

## 17.1 Vue d’ensemble : 4-6 mois avec 2-3 devs full-stack + 1 designer

### Phase 0 — Setup (Semaine 1-2)

<!-- TABLE START -->
| Jalon | Responsable | Livrable |
| --- | --- | --- |
| Fixer la stack technique | Tech Lead | Monorepo initialise (React Native/Expo + Supabase) |
| Design system setup | Designer + Dev | Tokens couleurs/typos, composants de base |
| Schema de base de donnees | Tech Lead + Product | Tables creees, migrations versionnees |
| Compte CinetPay sandbox | Tech Lead | Integration sandbox testee |
| Compte Mapbox | Tech Lead | Carte fonctionnelle avec style dark |
<!-- TABLE END -->

### Phase 1 — Core (Semaine 3-8)

<!-- TABLE START -->
| Jalon | Estimation | Dependances |
| --- | --- | --- |
| Inscription / Auth (OTP) | 1-2 semaines | Twilio/Termii setup |
| Onboarding + calibrage Palais | 1 semaine | Auth fonctionnelle |
| Feed personnalise + Fiche lieu | 2-3 semaines | Schema DB |
| Carte interactive (Mapbox) | 1-2 semaines | Schema DB |
| Check-in (systeme VTC) | 2-3 semaines | API geoloc, base lieux |
| Avis structure | 1-2 semaines | Check-in fonctionnel |
<!-- TABLE END -->

### Phase 2 — Engagement (Semaine 7-12)

<!-- TABLE START -->
| Jalon | Estimation | Dependances |
| --- | --- | --- |
| Algorithme Palais (5 axes + mise a jour) | 3-4 semaines | Check-in + onboarding |
| Systeme de progression (5 stades + 5 archetypes) | 2 semaines | Check-in fonctionnel |
| Profil utilisateur + collection titres | 1-2 semaines | Progression |
| Sauvegarde / Favoris | 0.5 semaine | Fiche lieu |
| Coup de Coeur | 0.5 semaine | Auth |
| Recherche + Filtres | 1-2 semaines | Base lieux |
| Notifications push (VTC + basiques) | 1 semaine | Check-in |
<!-- TABLE END -->

### Phase 3 — Monetisation (Semaine 10-16)

<!-- TABLE START -->
| Jalon | Estimation | Dependances |
| --- | --- | --- |
| Paywall geographique | 1-2 semaines | Geoloc + carte |
| Integration CinetPay (paiement) | 3-4 semaines | Compte CinetPay, KYC |
| Gestion abonnements + grace period | 1-2 semaines | Paiement |
| Partage WhatsApp | 0.5 semaine | Fiche lieu |
| Moderation basique | 1 semaine | Avis |
| Admin panel | 2-3 semaines | Toutes les features core |
<!-- TABLE END -->

### Phase 4 — Polish & Launch (Semaine 14-18)

<!-- TABLE START -->
| Jalon | Responsable |
| --- | --- |
| Pre-chargement des 50-100 lieux | Equipe terrain + Allies |
| Tests beta fermes (20-30 foodies) | Product + QA |
| Correctifs post-beta | Dev |
| Soumission stores (App Store + Google Play) | Tech Lead |
| Lancement public | Toute l’equipe |
<!-- TABLE END -->

### Phase 5 — Mission 1 terrain (en parallele, Semaine 6-12)

<!-- TABLE START -->
| Action | Responsable |
| --- | --- |
| Interviews users (20-30 foodies) | Allies + Pioneer |
| Interviews restos (20 restaurants cibles) | Allies |
| Tests de promesse & storytelling | Pioneer |
| Onboarding des 20 premiers restaurants | Allies |
<!-- TABLE END -->

## 17.2 Parallelisation

Avec 2 devs, les estimations sont parallelisables : - Dev 1 : Frontend (Feed, Fiche, Carte, Profil, UI) - Dev 2 : Backend (Auth, Palais, Matching, Paiement, Admin) - Designer : en amont de chaque phase (wireframes -> maquettes -> handoff)

Estimation realiste : 16-20 semaines (4-5 mois) avec 2 devs + 1 designer.

# 18. Decisions architecturales resolues

## 18.1 Les 8 tensions de la Bible — Resolues

<!-- TABLE START -->
| # | Tension | Decision | Justification |
| --- | --- | --- | --- |
| 1 | Paywall geographique | MAINTENU — 3 km gratuit, au-dela premium | 3 km = commune = rayon naturel. Le paywall geo EST le ciblage socio-economique. |
| 2 | Badges vs Titres | COMPLEMENTAIRE, SEPARATION FORMALISEE | Titres = qui tu ES (Palais x Maturite). Badges = ce que tu AS FAIT (permanent, collectionnable). |
| 3 | B2B sans architecture produit | 3 TIERS DEFINIS (Libre/Pro/Gold) mais B2C only en V1 | B2B en V1.5 quand le volume de data et la base user le justifient. |
| 4 | Coups de Coeur | INDEXE SUR LA MATURITE, PAS LE PORTEFEUILLE | La rarete est indexee sur la credibilite (stade), pas sur l’argent. |
| 5 | Multi-villes vs PMF Abidjan | DESIGN PORTABLE, ZERO ENERGIE D’EXECUTION | L’archi supporte « Guide a Abidjan, Touriste a Dakar ». Pas d’execution multi-villes avant M12. |
| 6 | Vanessa l’influenceuse | CANAL D’ACQUISITION, STATUT SEPARE | Statut « Ambassadrice » hors du systeme Palais. Programme formalise en V1.5. |
| 7 | Contrat philosophique vs calendrier commercial | COEXISTENCE, LE CONTRAT GAGNE | Les Foodie Games = defi COLLECTIF, pas leaderboard individuel. Quand ils se contredisent, le Contrat gagne. |
| 8 | Utilite vs Identite | L’IDENTITE GAGNE, L’UTILITE SERT | L’utilite est le hook d’acquisition. L’identite est le moat de retention. |
<!-- TABLE END -->

## 18.2 Contradictions corrigees par le brainstorming

<!-- TABLE START -->
| Contradiction | Avant | Apres (decision finale) |
| --- | --- | --- |
| Systeme de progression | 2 systemes contradictoires (spots dans la Bible section 3.2 vs paws dans ADVE-E) | Spots uniquement pour le MVP. Simple, comprehensible, mesurable. |
| Nombre d’archetypes | 13 archetypes + 5 stades = 65 noms de progression | 5 archetypes pour le MVP : Pisteur, Bouche d’Or, Gardien du Maquis, Vent d’Ailleurs, Omnivore. |
| Modes contextuels | 3 modes (Rapide/Crew/Explore) = 3 apps dans une app | 1 mode principal (feed + recherche). Pas de Mode Crew en V1. |
| Palette de couleurs | 2 palettes dans le meme document (section 9 vs section 13.3) | Palette finale unique : Noir #0A0A0A, Or #D4AF37, Vert Chat #50C878, Blanc casse #F8F6F0. |
| Prix annuel | 24 000 FCFA/an (section ADVE-V) vs 25 000 FCFA/an (section 10.1) | 25 000 FCFA HT/an (2 mois offerts sur 12 mois a 2 500 F). |
| Stades de maturite | Seuils variables selon les sections | 5 stades confirmes : 0-10, 11-20, 21-30, 31-50, 50+ spots uniques. |
| Matching | 4 dimensions ML sophistiquees | Score composite simple MVP : 0.15cosine + 0.30distance + 0.30note + 0.10recency + 0.15*novelty. |
| Monetisation B2C/B2B | Lancement simultane | B2C only en V1, B2B a partir de V1.5. |
<!-- TABLE END -->

# 19. Glossaire SPAWT

<!-- TABLE START -->
| Terme SPAWT | Signification | Remplace |
| --- | --- | --- |
| Spawter | Faire un check-in / Utilisateur actif de SPAWT | Check-in / User |
| Spawt | Un lieu decouvert / L’action de decouvrir / Le check-in lui-meme | Restaurant / Spot |
| La Meute | La communaute SPAWT | Community |
| Djidji | Expert reconnu (stade 4). Mot nouchi signifiant l’expert. | Power user |
| Trouvaille | Decouverte culinaire | Recommendation |
| Palais | Profil gustatif instinctif du spawter (5 axes bipolaires) | Taste profile |
| Le Chat | La voix / mascotte de l’app (felin, pas chatbot) | Assistant / Bot |
| Paws | Monnaie d’activite (backend, prevu V2) | Points |
| Coup de Coeur | Vote social rare, indexe sur la maturite | Like / Super like |
| Taniere | Spot favori recurrent | Favorite place |
| ADN du Lieu / Terroir | Profil multidimensionnel du restaurant (5 axes) | Restaurant profile |
| Mue | Changement lateral d’archetype (pas promotion ni retrogradation) | Profile change |
| Pioneer | Fondateur/trice | Founder |
| Co-Pilots | Co-fondateurs | Co-founders |
| Chiefs | Directeurs | Directors |
| Leads | Managers | Managers |
| Allies | Community managers terrain | Community managers |
| Crew / Gbonhi | Groupe d’amis / equipe | Squad |
| Manifeste | Document de vision | Mission statement |
| Pepite Verifiee | Lieu valide par 3+ experts (Djidji/Guide) | Verified gem |
| Institution | Lieu note >=4.5 stable +12 mois, 50+ avis | Classic venue |
<!-- TABLE END -->

### Les Faux-Pas (infractions)

<!-- TABLE START -->
| Faux-Pas | Description | Sanction |
| --- | --- | --- |
| Fake Review | Review sponsorisee non declaree, resto jamais visite, vengeance | Warning puis BAN |
| Gatekeeping | Refuser partager, fausses infos volontaires | Avertissement |
| Hater Toxique | Reviews mechantes gratuites, trolling | BAN definitif |
<!-- TABLE END -->

# 20. Annexes

## 20.1 Contrat SPAWT

### Ce que SPAWT promet au Spawter :
- Ton profil t’appartient. Jamais expose sans ton consentement.
- Les recommandations sont basees sur ton Palais, pas sur qui paie le plus.
- Tes donnees nourrissent la tribu.
- Le systeme recompense la qualite et la diversite, jamais la quantite brute.

### Ce que SPAWT promet au Lieu :
- Ta fiche reflete ce que la communaute pense reellement de toi.
- Payer ne change pas ta note. Payer te donne de la comprehension (data) et de la voix (reponses aux avis).
- Les badges restaurant sont gagnes organiquement.

### Ce que SPAWT promet a la Tribu :
- Pas de leaderboard. Pas de classement. Pas de competition entre spawters.
- L’identite prime sur l’utilite. La communaute prime sur le funnel.
- Le calendrier commercial respecte le contrat philosophique. Quand ils se contredisent, le contrat gagne.

## 20.2 Questions de calibrage onboarding (5 questions → Palais initial)

Question 1 → Axe Racines/Horizons « Quand tu as faim, tu penses a quoi en premier ? » - A) « Attieke poisson, alloco, garba — les classiques » → Racines (+40) - B) « Pizza, sushi, burger — le monde dans l’assiette » → Horizons (+40) - C) « Ca depend du jour » → Neutre (0)

Question 2 → Axe Taniere/Nomade « Samedi soir, tu fais quoi ? » - A) « Mon spot habituel. Ils me connaissent. » → Taniere (-40) - B) « Un endroit que je n’ai jamais teste » → Nomade (+40) - C) « Ca depend de qui m’accompagne » → Neutre (0)

Question 3 → Axe Exigeant/Enthousiaste « Tu goutes un plat moyen dans un nouveau lieu. Tu fais quoi ? » - A) « Je note mentalement. Je ne reviendrai pas. » → Exigeant (-40) - B) « C’est pas grave, l’ambiance compense » → Enthousiaste (+40) - C) « Je goute autre chose avant de juger » → Neutre (0)

Question 4 → Axe Foule/Secret « Le spot ideal c’est : » - A) « Plein de monde, ca prouve que c’est bon » → Foule (-40) - B) « Vide. Mon secret. Mon tresor. » → Secret (+40) - C) « M’en fous, c’est le plat qui compte » → Neutre (0)

Question 5 → Axe Maquis/Table « Ton cadre ideal pour manger : » - A) « Plastique, ventilo, tele qui griche — maquis life » → Maquis (-40) - B) « Nappe, menu carte, serveur en tablier » → Table (+40) - C) « Les deux me vont » → Neutre (0)

## 20.3 Schema de donnees check-in complet

{
  "spawt_checkin": {
    "id": "uuid_v4",
    "spawter_id": "uuid_v4",
    "lieu_id": "uuid_v4",
    "arrived_at": "2026-04-07T12:30:00+00:00",
    "notified_at": "2026-04-07T12:45:00+00:00",
    "snoozed_at": "2026-04-07T12:45:30+00:00",
    "snooze_count": 1,
    "checked_in_at": "2026-04-07T13:02:00+00:00",
    "left_at": "2026-04-07T13:45:00+00:00",
    "check_in_type": "active",
    "session_duration_minutes": 32,
    "geolocation": {
      "lat": 5.3364,
      "lng": -4.0267,
      "accuracy_meters": 8,
      "source": "gps"
    },
    "verification": {
      "is_geolocated": true,
      "distance_to_lieu_meters": 6,
      "is_verified": true
    },
    "avis": {
      "note_etoiles": 4,
      "texte": "Attieke poisson braise excellent...",
      "tags": ["copieux", "rapide", "a_refaire"],
      "photos": ["url1", "url2"],
      "is_complete": true
    },
    "context": {
      "heure_locale": "13:02",
      "jour_semaine": "lundi",
      "is_first_visit": true,
      "is_premium": false
    },
    "metadata": {
      "app_version": "1.0.0",
      "device_os": "android_13"
    }
  }
}

## 20.4 Regles anti-fraude

### Regles de base (toutes maintenues)

<!-- TABLE START -->
| Regle | Seuil | Action |
| --- | --- | --- |
| Frequence meme lieu | 1 spawt / 4 heures | Doublon rejete |
| Frequence globale | 5 spawts / jour | Au-dela : spawts flagges pour review |
| Vitesse deplacement | > 100 km/h entre 2 spawts | Flag automatique, spawt en attente de validation |
| Spawt sans geoloc | N/A | Accepte mais marque non_verifie, poids 0.5x |
| Patterns suspects | 10+ spawts identiques en 7 jours | Compte flagge, review manuelle |
<!-- TABLE END -->

### Regles ajoutees par le systeme VTC

<!-- TABLE START -->
| Regle | Description |
| --- | --- |
| Perimetre de detection | 10 metres (remplace les 150m precedemment envisages) |
| Temps minimum en zone | 15 minutes minimum pour declencher une notification (anti-fraude : pas de spawt en passant devant) |
| Check-in passif | Presence prouvee sans note = poids 0.5x |
| Session duration | Enregistree pour detecter les anomalies (ex: session de 2 min avec note 5 etoiles = suspect) |
| Coherence arrivee/depart | Si left_at - arrived_at < 5 min ET check-in actif → flag suspect |
<!-- TABLE END -->

## 20.5 Signal-to-Palais mapping

Chaque check-in genere des signaux qui alimentent les 5 axes du Palais :

<!-- TABLE START -->
| Signal du check-in | Axe impacte | Direction | Poids |
| --- | --- | --- | --- |
| Lieu de cuisine locale (ivoirienne, africaine) | Racines/Horizons | +Racines | +2 |
| Lieu de cuisine internationale | Racines/Horizons | +Horizons | +2 |
| Lieu deja visite (retour) | Taniere/Nomade | +Taniere | +1 |
| Lieu jamais visite (premier spawt) | Taniere/Nomade | +Nomade | +2 |
| Note >= 4 etoiles | Exigeant/Enthousiaste | +Enthousiaste | +1 |
| Note <= 2 etoiles | Exigeant/Enthousiaste | +Exigeant | +1 |
| Note = 3 (neutre) | Exigeant/Enthousiaste | 0 | 0 |
| Lieu avec > 50 spawts (populaire) | Foule/Secret | +Foule | +1 |
| Lieu avec < 10 spawts (cache) | Foule/Secret | +Secret | +2 |
| Lieu type maquis/street food | Maquis/Table | +Maquis | +2 |
| Lieu type restaurant/gastronomique | Maquis/Table | +Table | +2 |
| Lieu type casual/brasserie | Maquis/Table | 0 | 0 |
| Check-in apres 21h | Foule (si populaire) | +1 | contextuel |
<!-- TABLE END -->

## 20.6 Formule de matching complete (pseudo-code)

def calculer_score_matching(spawter, lieu):
    # DIMENSION 1 — Palais x ADN (poids: 0.15)
    palais_vector = [spawter.palais[axe] for axe in AXES]
    adn_vector = [lieu.adn[axe] for axe in AXES]
    score_cosine = (cosine_similarity(palais_vector, adn_vector) + 1) / 2

    # DIMENSION 2 — Distance (poids: 0.30)
    dist = distance_km(spawter.position, lieu.position)
    if dist <= 1:
        score_distance = 1.0
    elif dist <= 3:
        score_distance = 1.0 - (dist - 1) * 0.15
    elif dist <= 5:
        score_distance = 0.7 - (dist - 3) * 0.2
    else:
        score_distance = max(0, 0.3 - (dist - 5) * 0.05)

    # DIMENSION 3 — Note ponderee (poids: 0.30)
    score_note = lieu.note_ponderee / 5.0

    # DIMENSION 4 — Recency (poids: 0.10)
    jours_depuis_dernier_spawt = (now() - lieu.dernier_spawt_at).days
    score_recency = max(0, 1.0 - jours_depuis_dernier_spawt / 90)

    # DIMENSION 5 — Novelty (poids: 0.15)
    score_novelty = 1.0 if not spawter.a_deja_visite(lieu) else 0.2

    # SCORE FINAL
    score = (
        0.15 * score_cosine +
        0.30 * score_distance +
        0.30 * score_note +
        0.10 * score_recency +
        0.15 * score_novelty
    )

    # Affichage en pourcentage [50%, 99%]
    return round(50 + score * 49)

## 20.7 Conformite reglementaire Cote d’Ivoire

<!-- TABLE START -->
| Sujet | Regle | Action requise |
| --- | --- | --- |
| BCEAO | SPAWT ne stocke pas de fonds. CinetPay est l’intermediaire agree. | Verifier agrement BCEAO de CinetPay. Pas d’agrement propre necessaire. |
| ARTCI | Declaration des services en ligne. Loi 2013-450 (protection des donnees). | Declarer le service. Politique de confidentialite conforme. Consentement explicite pour la geolocalisation. |
| CGU/CGV | Conditions de vente pour abonnements. Droit de retractation 7 jours. | Rediger des CGV conformes au droit ivoirien. |
| Facturation | Obligation d’emettre un recu pour chaque paiement. | CinetPay genere les recus. SPAWT envoie par email/SMS. Factures B2B numerotees sequentiellement (SPAWT-2026-0001). |
| TVA | TVA a 18% applicable sur les services numeriques. | Prix B2C affiches TTC. Prix B2B affiches HT + ligne TVA. Declaration TVA mensuelle a la DGI. |
| Protection des donnees | Loi 2013-450 : consentement, droit d’acces, droit de suppression, stockage securise. | Pas de transfert hors CI sans accord. |
<!-- TABLE END -->

## 20.8 Categories de restaurants prioritaires (Mission 1)

<!-- TABLE START -->
| Categorie | Nombre | Exemples |
| --- | --- | --- |
| Date night / Premium | 5 | The Rooph, Texas Grillz, Kajazoma |
| Dabali / Racines clean | 5 | Chez Helene, Tantie Alice, Dabali express, Kampement |
| Boys / Barbecue | 3 | Sam’s, Vandal, La Baraque, Jay’s Meat & Seafood |
| Nouveaux restaurants | 3 | Boulevard, FF225, Le Cha, Kaiten |
| Hype / Instagram | 2 | Bushman Cafe, Madame Antika, Dipndip |
| Sceptiques | 2 | O Feu de Bois / L’Impasse, Le Paon |
<!-- TABLE END -->

Total : 20 restaurants a onboarder en Mission 1.

Le Palais donne l’identite. Les badges prouvent. Les tiers monetisent. La data connecte.

On ne chasse pas pour des points. On explore par instinct. On partage par passion.

SPAWT PRD V1.0.0 — 9 avril 2026 Redige par John, Product Manager (BMad) Sources : SPAWT_BIBLE_COMPLETE.md, brainstorming-session-2026-04-07-1430.md

