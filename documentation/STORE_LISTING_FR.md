# SPAWT — Fiches stores prêtes à coller (FR)

> Textes calibrés aux limites App Store / Play Store, ton SPAWT (direct, complice —
> jamais « gastronomie », jamais « restaurant » : on dit lieu, spot, maquis, table).
> ⚠️ **Ne mentionner Spawter Gold nulle part** dans les fiches : l'app ne vend rien,
> l'abonnement s'achète sur le web — toute mention d'achat externe fragiliserait la
> conformité Apple 3.1.3 (cf. `RUNBOOK_SOUMISSION_STORES.md` §2.8b).
> Compagnon : `DATA_SAFETY_PRIVACY.md` pour les formulaires de confidentialité.

---

## 1. Nom de l'app (les deux stores)

```
SPAWT
```

(30 caractères max iOS, 30 max Android — large.)

## 2. Sous-titre iOS (30 caractères max)

```
La carte du bon goût, Abidjan
```

(29 caractères.)

## 3. Description courte Android (80 caractères max)

```
Trouve le spot qui te ressemble à Abidjan. Ton Palais guide, la Meute valide.
```

(77 caractères.)

## 4. Description longue (App Store + Play Store, ~2 400 caractères)

```
Tu connais le moment. 20 h, le gbonhi demande « on mange où ? », et 45 minutes plus tard vous êtes encore en train de scroller. SPAWT tue ce moment-là.

SPAWT, c'est la carte du bon goût d'Abidjan. Pas un annuaire, pas un top 10 copié-collé : un Chat (félin, pas chatbot) qui apprend à te connaître et te souffle les spots faits pour TOI. Du maquis de quartier à la table qui se mérite, de Yopougon à Cocody.

TON PALAIS, TA BOUSSOLE
À l'inscription, 5 questions calibrent ton Palais : ton profil gustatif sur 5 axes (Racines ou Horizons ? Tanière ou Nomade ? Maquis ou Table ?…). Chaque suggestion est matchée à TON Palais, avec un score de 50 à 99 %. Plus tu spawtes, plus il s'affine. L'app apprend ce que ta bouche aime — pas ce qu'un classement veut te vendre.

DÉCOUVRE TON ARCHÉTYPE
Pisteur, Bouche d'Or, Gardien du Maquis, Vent d'Ailleurs, Omnivore : ton Palais révèle qui tu es à table. Et il bouge avec toi — la mue, on appelle ça.

UN SPAWT, C'EST VÉRIFIÉ
Ici, pas d'avis fantômes écrits depuis un canapé à 10 000 km. Un spawt = une visite réelle, vérifiée par géolocalisation. Le Guet veille : quand tu prends le temps dans un spot, il te propose de le spawter. Et ton avis pèse selon ton stade — de Touriste à Djidji, jusqu'à Guide. La confiance, ça se construit.

LA MEUTE A TOUJOURS UNE ADRESSE
La data vient de la communauté : la Meute. Des vraies bouches, des vrais spots, des photos prises sur place. Chaque lieu a son ADN, calculé depuis les avis de la Meute et comparé à ton Palais.

CE QUE TU TROUVES DANS L'APP
• 3 suggestions du jour, choisies pour ton Palais
• Des fiches complètes : photos, menu, avis de la Meute, prix moyen en F CFA, horaires des 7 jours, carte
• Tes modes de sortie : Manger, Découvrir, En groupe, En duo
• Tes favoris et ta collection de spawts
• Ta carte de spawter : stade, archétype, territoire

FAIT À ABIDJAN, POUR ABIDJAN
Prix en F CFA, communes d'Abidjan, vocabulaire de chez nous. Ta position ne sert qu'à valider tes spawts et à te proposer des lieux proches — activée seulement si tu le décides, jamais vendue, jamais donnée à des annonceurs. Suppression de compte en deux taps dans l'app.

Télécharge SPAWT. Arrête de chercher. Commence à trouver.
```

## 5. Mots-clés iOS (100 caractères max)

```
abidjan,maquis,garba,manger,sortir,spots,bouffe,avis,carte,découverte,cocody,resto,cuisine,foodie
```

(97 caractères.) Note : « resto » est du **métadonnée invisible** (personne ne le voit,
c'est ce que les gens tapent dans la recherche App Store) — il ne viole pas la règle de
vocabulaire UI. Si l'équipe préfère le retirer par principe, le remplacer par `dabali`.
Ne pas mettre « SPAWT » ni « food » seul (le nom est déjà indexé ; « food » figure dans
la catégorie).

## 6. Catégories

| Store | Principale | Secondaire |
|---|---|---|
| App Store | **Food & Drink** | **Lifestyle** |
| Play Store | **Food & Drink** (Cuisine et boissons) | — (une seule catégorie sur Play ; tags : « Food & Drink ») |

Classification d'âge : questionnaires des consoles (IARC côté Google) — réponses dans
`RUNBOOK_SOUMISSION_STORES.md` §3.3 ; contenu généré par les utilisateurs = oui, modéré.

## 7. Plan de screenshots (6-8 écrans)

### Tailles à produire

| Cible | Taille (portrait) | Obligatoire ? |
|---|---|---|
| iPhone 6,9" (15/16 Pro Max) | 1320 × 2868 px | Recommandé — devient le format de référence [à re-vérifier dans App Store Connect] |
| iPhone 6,7" | 1290 × 2796 px | Oui (ou couvert par le 6,9") |
| iPhone 6,5" | 1284 × 2778 px (ou 1242 × 2688) | Oui, si non dérivé automatiquement du plus grand |
| iPhone 5,5" | 1242 × 2208 px | Héritage — App Store Connect le dérive souvent des grands formats désormais [à re-vérifier : depuis 2025 Apple n'exige plus qu'un seul jeu iPhone dans la plupart des cas] |
| Android téléphone | 1080 × 1920 px min conseillé (PNG/JPEG, ratio 9:16, entre 320 et 3840 px) | Oui (min 2, max 8) |
| Android **feature graphic** | **1024 × 500 px** | Oui (bannière de la fiche) |
| Icônes consoles | 1024 × 1024 (Apple, sans transparence) · 512 × 512 (Play, PNG) | Oui |

Méthode : captures depuis l'APK/TestFlight sur device réel (compte démo propre, données
de prod seedées), puis habillage aux dimensions ci-dessus (fond noir `#0A0A0A` ou blanc
cassé `#FAFAF8`, titres en Klinsman, or `#C8A44E` en accent — brandbook).

### Les 8 écrans, dans l'ordre de la fiche

| # | Écran à capturer | Accroche à poser sur le visuel |
|---|---|---|
| 1 | **Feed** : le Chat + « Voici mes 3 suggestions du jour. » + les 4 modes | « Ton Chat sait où tu vas manger. » |
| 2 | **Fiche lieu** : onglets Média · Menu · Avis, score de match %, « ~N F CFA » | « Le spot, tout le spot. » |
| 3 | **Carte / recherche** : lieux autour de soi | « La carte du bon goût. » |
| 4 | **Révélation d'archétype** (« Voici ton palais » + Moka celebration) | « Découvre ton Palais. » |
| 5 | **Spawt vérifié / Le Guet** (notif « Le Guet a sonné » ou confirmation de spawt) | « Ici, un avis = une visite réelle. » |
| 6 | **Profil / carte de spawter** : stade, archétype, compteurs Spawts & Favoris | « De Touriste à Djidji. » |
| 7 | (option) **Collection / favoris** | « Ta collection d'adresses sûres. » |
| 8 | (option) **Calibration** (question avec emojis) | « 5 questions. Zéro blabla. » |

Les 3 premiers screenshots font 90 % du travail (seuls visibles avant de scroller) :
feed, fiche lieu, carte — dans cet ordre.

## 8. Notes de version 1.1.0 (« What's New » / « Nouveautés »)

Les deux stores, prêt à coller :

```
SPAWT débarque sur les stores. 🐾

• Ton Palais calibré en 5 questions — et tes 3 suggestions du jour, matchées à ton profil.
• Des fiches complètes : photos, menu, avis de la Meute, prix moyen en F CFA, horaires des 7 jours.
• Le Guet : tes spawts vérifiés par géolocalisation, si tu l'actives.
• Ta carte de spawter : stade, archétype, collection.
• Connexion par SMS, suppression de compte en deux taps, position jamais vendue.

Bienvenue dans la Meute.
```

(≈ 470 caractères — limite Play 500.) Pour les mises à jour suivantes : 3-5 puces max,
même ton, toujours finir par une phrase signée SPAWT.

## 9. Champs annexes des consoles

| Champ | Valeur |
|---|---|
| URL d'assistance (Apple, obligatoire) | `https://spawt.online` (ou page contact dédiée) |
| URL marketing (Apple, optionnel) | `https://spawt.online` |
| Politique de confidentialité (les deux) | `https://spawt.online/legal/confidentialite` |
| E-mail de contact Play (public) | adresse équipe à décider (éviter un e-mail perso) |
| Copyright (Apple) | `© 2026 SPAWT` (ou raison sociale exacte) |
| Prix | Gratuit, tous pays ou CI d'abord (décision produit — lancement CI seul recommandé) |
