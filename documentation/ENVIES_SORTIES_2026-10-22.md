# Envies de sortie — livraison du 22 octobre 2026

## Objectif et périmètre

Relier l’envie de sortir à un lieu ou un plat enregistré, une liste par occasion,
un choix explicite et, séparément, une visite déclarée. L’accueil mêle éditorial
SPAWT et personnalisation. La north star compte les personnes distinctes ayant
enregistré, proposé ou choisi une sortie sur sept jours. Le panel montre aussi
les actifs 24/72 h et les retours des cohortes arrivées à maturité.

Les comptes internes, fondateurs et bannis sont exclus des indicateurs ; aucune
activité historique n’a été transformée en nouvelle envie. La réservation et
l’édition collaborative des listes restent hors de cette livraison ; les votes
utilisent le groupe existant.

Sources produit : [Lean Canvas V5.1](https://docs.google.com/document/d/1XkpV-F41_8P-2YmSnJMGbFcFpmcqGL7jbeM-85eM9To/edit)
et documentation SPAWT du Drive. Les décisions de la conversation sur les listes
et la north star priment sur l’ancienne mesure du Canvas.

## État reçu

- **Base en production** : migrations additives 0086–0089 appliquées après sauvegarde PostgreSQL vérifiée. Propriété/RLS, identifiants de mutation stables, partage révocable, validation GPS et indicateurs serveur. Les favoris du build 40 restent compatibles.
- **Panel en production** : commit `23e4eef249fecafedc76f81dad69889d8164e576`, pages `/menus`, `/envies`, `/guet`. Publication/édition des plats, source et date, concurrence détectée ; validation GPS auditée et refus d’une validation si les coordonnées ont changé entre-temps.
- **Site en production** : fiches `/lieu/:id`, listes `/liste/:token`, rendu anonyme et aperçus sociaux, absence de cache des partages, 404 après révocation. Sept lecteurs sur `/statut`, certificat Android App Links reçu. Vérification TLS conservée avec une profondeur de chaîne adaptée au certificat croisé Let’s Encrypt.
- **Android 41 corrigé et recompilé** : source `e38c8f3ee5c6287e179ef70927ca4ea618ed1878`, 162536491 octets, SHA-256 `62074f4dc68ec3c84dfce3f1e191b4353a3a1b8e6e979a7232600040dd0a6aa9`. Compilation 39711862127 réussie ; recette native 39716463647 en cours. Canal public encore au build 40 jusqu’à réception complète.
- **Guet désactivé** : interrupteur `guet-proximity-v2` fermé pour tous les publics. Aucune campagne Firebase envoyée par cette livraison.

## Comportements livrés

« Ça me tente » enregistre un lieu ou un plat. Les listes personnelles peuvent
être créées, renommées, supprimées, partagées puis révoquées. Les écritures hors
ligne gardent leur propriétaire et leur identifiant après redémarrage ; la reprise
ne duplique pas l’activité. Les erreurs permanentes restent visibles.

La recherche couvre les noms de plats, variantes et accompagnements. Les prix
inconnus restent inconnus. **24 plats** de la carte brunch officielle d’IN’ Concept
Store ont été relus le 22 octobre, puis publiés depuis le panel et son API staff.
Exemple : Eggs Benedict, 7 000 F, alias « Œufs Benedict ». Cinq relevés historiques
de mars restent en brouillon. Ni photo non autorisée ni disponibilité du jour
inventée. Sources, dates et identifiants : `editorial/envies-2026-10/`.

Le catalogue contient **155 lieux**, dont **111 cartographiés**, **10 avis éditoriaux**,
**3 carnets** et **1 actualité** au contrôle. Un lieu publié sans note reste
explorable. Un enregistrement, une contribution ou une proximité ne crée pas de
visite. Les photos de menu et propositions GPS passent par la modération ; une
validation attribue les Paws une seule fois. Un rejet conserve le motif privé.

Aide et retours fournit sept contrôles de lecture, un reçu serveur et les réponses
privées de l’équipe. Le panel reçoit l’activité de l’app avec sa plateforme et son
build. Les anciens commentaires restés uniquement sur un téléphone ne peuvent
pas être déclarés récupérés sans accès à ce téléphone.

## Recette et preuves

- [Compilation signée 39701288073](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39701288073) : signature de la lignée publique, intégrité ZIP, identité native, backend et Firebase compilés reçus.
- [Recette Android finale 39708319589](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39708319589) : installation par-dessus le build 40, lectures réelles, hors ligne/reprise, retours/réponses, contributions/modération/Paws, recherche et listes, partage navigateur, révocation, ouverture HTTPS native et isolation des comptes.
- [CI app/panel 39708264026](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39708264026) et [SQL 39708264027](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39708264027) reçues vertes. 1 108 tests mobiles réussis (4 ignorés), 231 tests panel, 50 tests portail ; TypeScript, vocabulaire, i18n, compilation, PostgreSQL 15 et aller/retour des migrations, contrats Expo réels et nginx réel.
- `envies-reception/` : sauvegarde et schéma, source officielle du menu, captures du panel déployé, lecteurs publics et chaîne TLS. Les premières captures locales `visual-proof.json` utilisent explicitement des fixtures ; elles ne constituent pas une preuve native.
- Le premier essai Android 39706556027 a échoué sur le défilement du script après remise à zéro du formulaire photo ; 19 assertions terminées étaient réussies. Le script attend désormais le reçu puis le recherche aussi vers le haut. Les exigences de réception restent inchangées.

Les comptes de recette sont synthétiques et exclus de la north star. Les photos
techniques ne sont pas publiées ; les coordonnées simulées n’ont modifié aucun
lieu et leur justificatif technique est retiré après le contrôle. Aucune visite
personnelle n’est créée par ces tests.

## Guet et exploitation

Le binaire corrige les événements Expo, le déclencheur typé SDK55, les permissions
d’arrière-plan et la tâche indépendante du montage React. Contexte isolé par
compte, nettoyage à la déconnexion, 20 zones proches maximum, rayon 150 m,
rappel après deux minutes annulé lors d’un passage court. Messages selon envie
et visite, deux rappels quotidiens au total, silence local 22 h–9 h, même type de
rappel au même lieu au plus une fois par semaine. Un rappel d’avis exige une
visite explicite persistée.

La vérification de présence serveur exige une mesure récente (≤120 s), une
précision ≤50 m et une distance ≤100 m d’un point contrôlé. Elle ne garantit pas
l’absence de simulation sur un appareil compromis. Une visite déclarée reste
possible sans GPS et n’est alors pas marquée vérifiée.

**Avant activation publique du Guet :** réception sur téléphone physique au
premier plan, en arrière-plan et app fermée ; permissions refusées, passage court,
changement de compte, messages et limites. Seuls les points réellement contrôlés
seront éligibles. Une simulation d’émulateur ne remplace pas cette réception.

Les migrations `.down.sql` servent à tester la réversibilité ; ne pas les appliquer
sur des envies réelles sans sauvegarde et plan de restauration. En cas d’incident,
fermer les fonctions concernées et conserver les données ; ne pas redémarrer tout
le stack Supabase pour déployer une fonction Edge.

## Correction issue de la réception native

La recette 39710670306 a confirmé une action optimiste encore en attente après
45 secondes : une mutation ajoutée pendant la lecture finale d’une synchronisation
rejoignait cette lecture sans être envoyée. `syncOutings` attend désormais la lecture
en cours, contrôle le propriétaire puis vide les nouvelles mutations. Le test de
régression échoue avant correction et réussit après, y compris la protection lors
d’un changement de compte. Les preuves du candidat initial ne valident pas le
nouveau binaire : compilation et réception native complètes sont requises.

La même course est reçue dans Chromium sur l’interface réelle avec réponses réseau
interceptées : ancien export = une action en attente, aucune écriture ; source
corrigée = une écriture de partage, file vide et bouton « Désactiver le lien »
visible. `envies-reception/sync-ui-proof.json` distingue explicitement cette
régression locale de la recette APK/production.
