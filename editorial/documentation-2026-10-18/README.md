# Fiches documentaires sans note — 18 octobre 2026

Demande : retrouver les autres lieux dans la documentation SPAWT et créer leur fiche sans note.

`places.json` est le manifeste du lot : 145 nouveaux lieux, tous brouillons privés, avec identifiants déterministes, sources, faits documentaires, limites, profil rédactionnel et note d'équipe. Aucun avis mobile ou éditorial, visite, note, photo tierce ou signal de recommandation n'est créé. Les agrégats `place_adn` sont initialisés à zéro avis et zéro confiance ; le panel affiche « — » en l'absence d'avis.

## Périmètre relu

- 129 fiches enrichies du Drive : 18 hors périmètre Abidjan ou à coordonnées 0/0 restent dans Recherche. Les 111 autres sources donnent 108 fiches après trois rapprochements.
- Rapports Mission 1 et Mission 2 : DipNDip, CinnamonBox, Eric Kayser Golf, Pouripouri et Féféivoire.
- Bible du dépôt documentaire : quinze adresses préparatoires, dont Chez Ambroise déjà présent dans le lot enrichi. Une intention de visite n'est pas présentée comme une visite réalisée.
- Validation des quatre fiches brunch : Parenthèse, Azalaï Hôtel Abidjan, IN’ Concept Store et Africafé Ivoire Trade Center. Les tarifs de plats ou de formules ne sont pas convertis en ticket moyen.
- 21 lieux nommés dans les observations manuelles de recherche, après rapprochement avec les autres sources. Les opinions tierces ne sont pas transposées en commentaires SPAWT.
- Archive terrain du Mac : rapports corroborants et classeur de collecte de 100 lignes préremplies en numéro/date, sans noms de lieux. Il ne fournit pas 100 lieux supplémentaires.
- Visuel « Promenade culinaire » : événement portant sur 17 établissements non nommés dans le visuel, sans création d'un faux lieu « Promenade ».

## Rapprochements et limites

Akouyê : même nom, même téléphone et adresse, points distants d'environ 12 mètres. Chez François / Chez François Bingerville : même point et adresse ; téléphone laissé vide car contradictoire. Comanche / Comanche Diner : même téléphone et voie Djibi. Ces rapprochements restent documentés dans le manifeste.

Africafé ITC et Plateau restent distincts. Les deux Azito Palmeraie gardent des libellés Cocody/Yopougon et des points vides à cause des contradictions. Les autres conflits de coordonnées restent également vides. Au total, 44 fiches sans coordonnées. Les succursales imprécises, notamment DipNDip, Eric Kayser, Dabali Xpress et Burger King, sont signalées pour qualification.

Les 145 gammes tarifaires et tickets moyens restent inconnus ; aucun prix n'est inféré. Les liens de menus web restent dans les sources, car `places.menu_urls` sert aux images de menu dans le mobile. Aucune photographie n'est copiée sans droits établis.

## Écriture et validation

Sauvegarde préalable : `/var/lib/postgresql/data/spawt-backups/before-documentary-drafts-20261018.dump`, 4 095 520 octets, format pg_dump CUSTOM.

Migration 0076 : GPS et gamme tarifaire peuvent être nuls pour les brouillons. Une contrainte empêche la publication tant que les champs du contrat mobile ne sont pas renseignés. Le rollback refuse de supprimer ou d'inventer des données pour satisfaire l'ancien schéma.

Import transactionnel sous les droits du compte staff Xtincell : lieu, agrégat vide, profil privé, note de provenance et rapprochement des sources via les RPC existantes. Essai complet annulé avant application. 147 références rattachées. Les dix fiches publiques, les commentaires et les visites préexistants restent inchangés. Les identifiants préexistants font échouer une réexécution plutôt que d'écraser un enrichissement manuel.

Validation : tests PostgreSQL des brouillons, publication et rollback ; tests admin, TypeScript et ESLint ; contrôles mobile requis par le dépôt. La recette du panel en production et les totaux finaux sont consignés dans `verification.json`.

Recette production réussie : quatre contrôles navigateur réels Xtincell, dont sauvegarde d’un brouillon incomplet ; zéro erreur API/JS. Panel épinglé au commit `66bc56ee6f894781bb0f131504622f43733ed083`, déploiement `mf83j367n9gcq0xupwp6tgrp` terminé le 18/10/2026 à 12:54 UTC. Le bundle servi est identique au build vérifié. `inventaire.csv` fournit la liste et les liens vers chaque fiche.
