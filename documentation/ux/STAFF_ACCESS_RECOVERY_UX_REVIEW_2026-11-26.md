# Connexion et récupération staff SPAWT

26 novembre 2026 · Issue de la [PR de référence](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/25) · Avant `1da49c5` · Candidat `codex/spawt-admin-staff-recovery-ux`

## Décisions

- Le lien de récupération suit le bouton de connexion dans l’ordre de tabulation. Le champ porte uniquement le nom « Mot de passe ». Placement observé sur les connexions web de [Paramount+, écran 1/7](https://mobbin.com/flows/5199e8ad-f2ba-4be7-8de8-f31b848a4baf?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) et de [GitBook, écran 1/7](https://mobbin.com/flows/efe62bb2-dbee-40fe-9b34-58fb7794b891?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp).
- Une carte SPAWT regroupe le champ e-mail, le bouton et le retour à la connexion. Le formulaire en un champ et le lien de retour existaient déjà. Référence de structure [Hotjar, demande de récupération web](https://mobbin.com/screens/2d832835-1405-4f94-9bcf-e27a226196c8?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp).
- Le message de récupération reste conditionnel et indique quoi faire si le message n’arrive pas. Référence de formulation conditionnelle [Threads, aide de connexion web](https://mobbin.com/screens/03814870-57fe-4d78-956b-9aa68f77ca24?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp).
- Le contraste des champs, la gestion du focus et les messages d’erreur découlent de la revue du code et de la recette SPAWT. La carte garde Moka, Klinsman, Gotham et les tokens existants.

## Résultats mesurés

| Vérification | Avant | Candidat |
| --- | --- | --- |
| Connexion, hauteur des champs, du bouton et du lien | 35 / 29 / 18 px | 48 / 48 / 44 px |
| Demande de lien, hauteur du champ, du bouton et du retour | 21 / 29 / 18 px | 48 / 48 / 44 px |
| Bordure du premier champ de connexion sur blanc | 4,54:1 | 4,78:1 |
| Focus du premier champ, mobile émulé | 1 px à 2,40:1 | 3 px à 19,80:1 |
| Focus du premier champ, desktop | 1 px à 19,03:1 | 3 px à 19,80:1 |
| Alerte après un refus de connexion | 0 | 1, générique |
| Focus après demande confirmée, lien expiré, mot de passe modifié | Page dans les trois cas | Statut, alerte, statut |

Le clavier atteint l’e-mail, le mot de passe, le bouton puis le lien. Les écrans mesurés du candidat tiennent dans les deux largeurs sans défilement horizontal. Les 48 captures comprennent les formulaires, les états d’attente, les erreurs et les confirmations.

## Ce que teste la recette

- La référence passe ses **241 tests**. Le candidat passe **256 tests**, dont 15 ajouts pour la connexion et la récupération. Lint et build TypeScript/Vite passent.
- La recette navigateur charge les deux builds dans Chromium, à **1440 × 900** et **390 × 844**, avec le même flag activé et des réponses Auth simulées. Elle mesure les cibles, le contraste du contour des champs et du focus, l’ordre de tabulation et l’absence de débordement horizontal. Voir `metrics.json` et les captures PNG jointes au dossier de recette.
- Le formulaire de connexion couvre le refus avec message générique, la correction, la relance et la redirection réussie. La récupération couvre l’attente, la confirmation, une nouvelle demande, la panne de transport, l’expiration, la correction de mots de passe différents et le retour à la connexion après un changement simulé.
- La confirmation affichée est identique après les réponses simulées de succès, d’adresse inconnue, de quota et d’erreur serveur. Une panne de transport préserve la saisie et permet de réessayer.
- La recette vérifie que le jeton est retiré de l’adresse, que l’échange attend la soumission, que le refus d’un lien expiré empêche la modification et que le client demande une déconnexion globale après succès. Les cas de refus staff et le flag désactivé sont contrôlés dans les tests d’intégration.

## Reproduire

Construire le panel de chaque commit depuis `spawt-admin` avec les dépendances verrouillées, puis lancer le script depuis le candidat avec Playwright disponible.

```sh
npm ci
VITE_SUPABASE_URL=https://auth.spawt-ux.test VITE_SUPABASE_ANON_KEY=local-fixture VITE_STAFF_RECOVERY_ENABLED=true npm run build
node scripts/ux-staff-recovery.mjs /chemin/avant/dist /chemin/apres/dist /chemin/recette
```

`CHROMIUM_EXECUTABLE` permet d’indiquer un binaire Chromium local. Le script intercepte le trafic des pages du test, y compris les tentatives de télémétrie.

## Validation humaine et limites

Aucun membre de l’équipe n’a effectué la recette. Pour mesurer l’usage, faire essayer les deux builds de test dans un ordre alterné, au clavier sur desktop et au toucher sur mobile. Relever la réussite sans aide, les blocages et le temps pour trois tâches identiques : se connecter après un refus, redemander un lien arrivé à expiration et se reconnecter après modification. Tester les annonces avec un lecteur d’écran.

Les réponses simulées établissent ce que le panel affiche et les appels qu’il émet. La réception d’e-mail, la révocation effective et l’équivalence des réponses réseau et des délais côté serveur demandent une recette sur une instance Auth de test. La production, le SMTP, Coolify et les réglages Auth sont hors du périmètre de cette livraison.
