# Guet — raccordement des sources cartographiques

## Correction du bilan précédent

Une localisation précise publiée sur une carte ou sur la fiche de l’établissement suffit à documenter le point de référence du Guet. Un passage physique de l’équipe dans chaque restaurant n’est pas une condition du cahier des charges. La Story 4.1 autorise explicitement une validation « présentiel ou Google Maps ».

Le bilan du 30 octobre confondait trois choses : la position du lieu, la preuve de présence d’un Spawter et la recette du mécanisme sur un téléphone réel. Le manque de recette sur téléphone ne rend pas inutilisables les coordonnées cartographiques existantes.

## Sources relues le 31 octobre

Les 101 positions documentaires du catalogue ont été confrontées aux sources publiques actuelles. La réponse HTTP seule n’est pas considérée comme une confirmation : le nom, la succursale et le point du lieu ont été rapprochés des données structurées ou du marqueur de carte.

| Résultat | Lieux | Traitement appliqué |
|---|---:|---|
| Point actuel reconfirmé | 98 | Coordonnées stockées conservées exactement et source enregistrée |
| Source actuelle donnant un autre point | 2 | Chez Hao et Le Montmorency corrigés sous contrôle des anciennes coordonnées, puis source enregistrée |
| Fermeture définitive signalée par la source | 1 | Chez le Cultivateur exclu du lot Guet ; sa fiche n’a pas été modifiée |
| **Total du lot Guet** | **100** | **98 confirmations et 2 corrections documentées** |

Le détail des sources, empreintes, coordonnées et exclusions figure dans `guet-cartography-2026-10-31.json`. Les dix anciennes positions de Mission1 sont des estimations de quartier et ne sont pas reprises telles quelles. Les 44 fiches sans coordonnées restent à localiser ; cette absence dans SPAWT ne signifie pas qu’elles sont absentes des cartes externes.

Chez Hao est identifié par la même fiche ChicMenu et le même téléphone. Le Montmorency est identifié par son site officiel, son adresse et son téléphone ; ses données structurées, sa carte et son itinéraire concordent. Pour Azalaï, le marqueur de l’établissement dans la carte Google intégrée au site officiel confirme le point existant ; le centre de la caméra et les données structurées contradictoires du site ne sont pas utilisés comme coordonnées du lieu.

## Correction du raccordement

La migration `0092_guet_cartographic_locations.sql` accepte une précision métrique inconnue (`NULL`) lorsque la source est une URL HTTP(S) explicite. Une précision effectivement mesurée reste bornée entre 0 et 100 mètres. Aucun nombre n’est inventé pour transformer une carte en relevé GPS.

Le correctif du formulaire du panel est déployé : il utilise « Source de localisation » et laisse la précision facultative. Un champ vide envoie `NULL`, sans être converti en zéro. Les contributions GPS conservent leurs exigences de mesure. La vérification publique du JavaScript servi confirme ces changements ; le formulaire authentifié n’a pas été exercé dans cette réception.

Le contrôle des droits staff, la correspondance exacte entre la position contrôlée et celle de la fiche, l’exclusion des brouillons et le refus d’une validation portant sur une ancienne position sont conservés. Les règles de preuve de présence d’un Spawter restent indépendantes.

Le lot public `supabase/seed/guet_cartographic_locations_2026_10_31.sql` cible les 100 points contrôlés et journalise les sources et les deux corrections. Il ne crée aucun Spawt, avis ou Paws. Les nouvelles validations ont une source URL et une précision inconnue (`NULL`), sans relevé GPS ni présence physique prétendus. Les contrôles existants à la même position sont conservés ; une position incompatible fait échouer le lot. Le rejeu ne réécrit ni validation ni journal.

**L’APK42 reste inchangée**, avec la source compilée `8cf7ea89ef7610b69c28f7608218f4e005dbdc30` : elle consomme déjà `public_guet_places`.

## Validation reçue

Le correctif initial `30ac2353a3a78a49acbc8c866ad9406312bcf77a` avait reçu ses quatre contrôles. Le commit final du lot et de ses tests, `1775cc7449b0f8a08357462988a4de02fabe4503`, passe également les quatre workflows :

- [SQL push — 41211729862](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41211729862)
- [SQL PR — 41211733865](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41211733865)
- [Application/panel push — 41211729846](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41211729846)
- [Application/panel PR — 41211733903](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41211733903)

Le panel reçoit 234 tests, dont les trois tests du formulaire Guet. L’application reçoit 1 146 tests et quatre snapshots ; quatre tests préexistants restent ignorés. Le runner PostgreSQL reçoit le schéma neuf, les permissions, la migration 0092, ses cas cartographiques et GPS, puis le retour arrière et la réapplication. Les 92 contrats Deno passent également.

Le test indépendant du lot charge ses 100 fixtures depuis la liste opérationnelle. Il reçoit le premier passage, le rejeu, les refus en cas d’identité ou de position modifiée, la conservation d’une validation GPS compatible et les deux corrections autorisées. Une validation staff effectuée après import à la même position reste intacte au rejeu. Le test vérifie également l’absence de nouvelles visites, preuves de présence, contributions ou Paws et les éléments du journal nécessaires à un retour ciblé.

## Résultat de la lecture publique

**La lecture API publique du 31 octobre 2026 confirme 100 lieux éligibles au Guet.**

| Contrôle public | Avant | Après |
|---|---:|---:|
| Lieux publiés | 155 | 155 |
| Lieux éligibles au Guet | 0 | 100 |
| Drapeaux `guet-proximity-v2` actifs, sans échéance | 4 | 4 |
| Coordonnées modifiées par le lot | — | 2 : Chez Hao et Le Montmorency |

La relecture API du `2026-10-31T14:58:44.362559+00:00` reçoit HTTP 200 pour les trois lectures, les **100 identifiants exacts** du lot et la conservation des autres coordonnées. Chez le Cultivateur reste exclu du Guet. Les dates de dernière visite admissible restent nulles ; aucune date de visite n’a été déduite d’une source cartographique.

La migration publique `0092_guet_cartographic_locations` et le lot associé sont versionnés dans le commit testé `1775cc7449b0f8a08357462988a4de02fabe4503`. Les empreintes de ces fichiers SQL sont consignées dans le JSON associé. Le corpus des sources publiques relues porte le SHA-256 `dfb685ba575caec895179b270768b9deb32ecc86dad5ac4f4fe14a3042625417`.

Les lectures API publiques avant/après, les sources documentaires et les résultats de CI sont consignés dans `guet-cartography-2026-10-31.json`.

## Vérification publique du panel

Le code du formulaire a été testé au commit `1775cc7449b0f8a08357462988a4de02fabe4503`. La vérification suivante porte sur les fichiers accessibles publiquement depuis [admin.spawt.online](https://admin.spawt.online/).

La relecture publique indépendante du 31 octobre à **16 h 08 min 15 s, heure de Douala (UTC+1)** reçoit HTTP 200 pour la page et le fichier JavaScript `index-BSrIKRxy.js`. Ce fichier contient le nouveau libellé, les aides cartographiques, la précision facultative et l’envoi de `NULL` quand elle est vide ; l’ancien libellé imposant une preuve sur place est absent. Son empreinte et le reçu de lecture sont consignés dans le JSON associé. Cette vérification porte sur les fichiers servis publiquement. **Aucun essai du formulaire authentifié n’est revendiqué.**

## Réceptions restant ouvertes

La réception sur un téléphone réel reste à effectuer pour le déclenchement, les permissions et les notifications. Elle ne conditionne pas l’admissibilité des sources cartographiques. Aucun essai physique n’est revendiqué ici. Le canal APK officiel reste sur le **build 41** ; cette intervention ne recompile ni ne publie l’APK42.
