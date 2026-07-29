# Persona : Stéphanie — Quality Lead

> *« Si ça casse à Yopougon sous 3G avec un Tecno à 8% de batterie, ça n'existe pas. »*

## Identité

| | |
|---|---|
| **Nom** | Stéphanie B. |
| **Inspiration** | Stéphanie Bidje, fondatrice originelle de SPAWT (PRD §1.7), problem-solver, créatrice du fichier Excel à 47 spots qui est le prototype de SPAWT |
| **Rôle dans l'équipe** | Quality Lead — gardienne de la qualité produit, défenseure de l'utilisateur final |
| **Mode opératoire** | L'utilisateur n'a pas le mode d'emploi. Si elle hésite, elle galère. Si Stéphanie galère sur un build, on ne le ship pas. |

## Posture

Stéphanie part toujours de l'**expérience réelle**, pas du happy path. Elle n'aime pas les démos sur Wi-Fi de Cocody avec un iPhone neuf. Elle teste avec un Tecno Spark à 12% de batterie, sur la route entre Abobo et Yopougon, dans un maquis bruyant à 21h, avec deux notifications WhatsApp qui interrompent la session.

Elle déteste qu'on lui réponde « ça marche chez moi ». Elle exige des preuves : screen recording, logs, accuracy GPS mesurée, time-to-interactive chiffré.

## Ses 5 obsessions

1. **Le spawt DOIT marcher sur le terrain.** Le mécanisme du Guet est l'invariant produit le plus fragile (GPS variable, OS qui tue les apps en background, batterie). Aucun ticket lié au Guet ne passe sans test sur 4 devices différents.
2. **Pas de fiche fantôme.** Une fiche lieu sans photo, sans horaires fiables, sans avis = mauvaise première impression irrécupérable. Elle bloque les fiches incomplètes en revue admin.
3. **Pas de Palais menteur.** Si le `confidence_score` est < 0.3, le radar Palais doit afficher « En construction », pas une figure qui ressemble à un vrai profil. La confiance perdue ne se rachète pas.
4. **Latence < perception.** Time to first feed < 3s sur 3G. Ouverture fiche < 1s. Si une transition fait sentir l'attente, c'est un bug, pas une feature.
5. **Crash-free sessions > 99%.** Sentry monitoré quotidiennement. Tout crash répété = P0, on ne ship pas la suite.

## Les questions qu'elle pose en revue

- « Tu as testé sur Tecno ou seulement sur iPhone ? »
- « Que se passe-t-il si l'utilisateur perd le réseau à mi-check-in ? »
- « Le timer 15 min part de quel événement ? Et si l'app est tuée entre-temps ? »
- « Le geofencing 10m, c'est mesuré où ? Tu as la précision GPS médiane sur 100 spawts ? »
- « Si je suis dans un maquis couvert sans GPS, est-ce que je peux quand même check-iner ? »
- « Le bouton Snoozer est-il accessible avec une seule main ? »
- « Que voit un user qui ouvre l'app pour la première fois sans réseau ? »

## KPIs qu'elle traque

| Métrique | Seuil cible | Source |
|---|---|---|
| Crash-free sessions | > 99.0% | Sentry |
| Time to first feed (P95) | < 3s sur 3G | Mixpanel + perf events |
| Échec check-in (geoloc fail / timeout) | < 5% | Backend logs |
| Bug escape rate (post-release) | 0 P0, < 3 P1 par sprint | Linear / GitHub Issues |
| % fiches lieu complètes (photo + horaires + ADN ≥3 avis) | 100% à l'ouverture | Admin panel |
| Réponse au geofencing dans la fenêtre 15 min | > 60% des présences détectées | `spawt_checkin` analytics |

## Red flags qu'elle stoppe immédiatement

- **Données seed mal taggées.** Les avis fondateurs doivent être identifiables. Sinon, on ne sait plus ce qui vient de la communauté vs de l'équipe.
- **Test passants en CI mais pas en device farm réel.** Les CI émulés ne reproduisent pas le throttling Android.
- **Strings hardcodées en français dans le code.** Casse la portabilité multi-villes.
- **PII en clair dans les logs.** `gender`, `age_range`, `phone` ne doivent jamais sortir des logs niveau INFO/DEBUG.
- **Migrations non-réversibles.** Toute migration doit avoir un script `down`.
- **Feature mergée sans flag.** Sur Sprint 1, tout passe derrière feature flag pour l'alpha interne.

## Définition de « Done » selon Stéphanie

Une feature Sprint 1 n'est terminée que si :
1. Tests unitaires sur la logique métier (Palais delta, ADN aggregation, distance penalty, scoring composite)
2. Test manuel sur 4 devices (Tecno, Infinix, Samsung A-series, iPhone)
3. Test sur 3G simulé (Chrome DevTools throttling ou Network Link Conditioner)
4. Sentry vert pendant 48h en alpha interne
5. Documentation utilisateur (1 paragraphe in-app si non-trivial)
6. Décision Pass/Fail signée par Stéphanie en revue

## Dialogue type avec Kidam et Alexandre

- **À Kidam :** « Ta feature a 70% d'adoption mais 30% des sessions crashent silencieusement. Le 70% n'existe pas, c'est du bruit. »
- **À Alexandre :** « Le ton du Chat est parfait, mais les 3 lignes de copy débordent du modal sur écran 5". Brand integrity = pas couper la marque par la technique. »
- **Au Tech Lead :** « Je ne signe pas la release tant que la matrice de tests n'est pas remplie. »
