# Guet — raccordement des sources cartographiques

## Correction du bilan précédent

Une localisation précise publiée sur une carte ou sur la fiche de l’établissement suffit à documenter le point de référence du Guet. Un passage physique de l’équipe dans chaque restaurant n’est pas une condition du cahier des charges. La Story 4.1 autorise explicitement une validation « présentiel ou Google Maps ».

Le bilan du 30 octobre confondait trois choses : la position du lieu, la preuve de présence d’un Spawter et la recette du mécanisme sur un téléphone réel. Le manque de recette sur téléphone ne rend pas inutilisables les coordonnées cartographiques existantes.

## Sources relues le 31 octobre

Les 101 positions documentaires du catalogue ont été confrontées aux sources publiques actuelles. La réponse HTTP seule n’est pas considérée comme une confirmation : le nom, la succursale et le point du lieu ont été rapprochés des données structurées ou du marqueur de carte.

| Résultat | Lieux | Traitement préparé |
|---|---:|---|
| Point actuel reconfirmé | 98 | Conserver exactement les coordonnées stockées et enregistrer la source |
| Source actuelle donnant un autre point | 2 | Corriger Chez Hao et Le Montmorency sous contrôle des anciennes coordonnées, puis enregistrer la source |
| Fermeture définitive signalée par la source | 1 | Exclure Chez le Cultivateur du lot Guet |
| **Total du lot Guet** | **100** | **98 confirmations et 2 corrections documentées** |

Le détail des sources, empreintes, coordonnées et exclusions figure dans `guet-cartography-2026-10-31.json`. Les dix anciennes positions de Mission1 sont des estimations de quartier et ne sont pas reprises telles quelles. Les 44 fiches sans coordonnées restent à localiser ; cette absence dans SPAWT ne signifie pas qu’elles sont absentes des cartes externes.

Chez Hao est identifié par la même fiche ChicMenu et le même téléphone. Le Montmorency est identifié par son site officiel, son adresse et son téléphone ; ses données structurées, sa carte et son itinéraire concordent. Pour Azalaï, le marqueur de l’établissement dans la carte Google intégrée au site officiel confirme le point existant ; le centre de la caméra et les données structurées contradictoires du site ne sont pas utilisés comme coordonnées du lieu.

## Correction du raccordement

La migration `0092_guet_cartographic_locations.sql` accepte une précision métrique inconnue (`NULL`) lorsque la source est une URL HTTP(S) explicite. Une précision effectivement mesurée reste bornée entre 0 et 100 mètres. Aucun nombre n’est inventé pour transformer une carte en relevé GPS.

Le formulaire du panel devient « Source de localisation » et laisse la précision facultative. Un champ vide envoie `NULL`, sans être converti en zéro. Les contributions GPS conservent leurs exigences de mesure.

Le contrôle des droits staff, la correspondance exacte entre la position contrôlée et celle de la fiche, l’exclusion des brouillons et le refus d’une validation portant sur une ancienne position sont conservés. Les règles de preuve de présence d’un Spawter restent indépendantes.

Le lot `supabase/seed/guet_cartographic_locations_2026_10_31.sql` applique uniquement les points préparés et journalise les sources et les deux corrections. Il ne crée aucun Spawt, avis ou Paws. **L’APK42 reste inchangé** : il consomme déjà `public_guet_places`.

## Validation reçue

Le commit `30ac2353a3a78a49acbc8c866ad9406312bcf77a` passe les quatre workflows :

- SQL push : https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41210959758
- SQL PR : https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41210963922
- Application/panel push : https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41210959756
- Application/panel PR : https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41210963789

Le panel reçoit 234 tests, dont les trois tests du formulaire Guet. L’application reçoit 1 146 tests et quatre snapshots ; quatre tests préexistants restent ignorés. Le runner PostgreSQL reçoit le schéma neuf, les permissions, la migration 0092, ses cas cartographiques et GPS, puis le retour arrière et la réapplication. Les 92 contrats Deno passent également.

Le lot de données fait l’objet d’une vérification séparée avant application.

## Statut de déploiement

**Correctif et données préparés ; application serveur encore en attente.** La relecture publique avant intervention donne 155 lieux publiés, zéro lieu Guet et les quatre drapeaux `guet-proximity-v2` actifs. La session opérateur Coolify utilisée précédemment a expiré.

L’application effective de la migration et du lot doit être suivie d’une relecture publique du catalogue Guet. La réception sur un téléphone réel reste à effectuer pour le déclenchement, les permissions et les notifications. Elle ne conditionne pas l’admissibilité des sources cartographiques.
