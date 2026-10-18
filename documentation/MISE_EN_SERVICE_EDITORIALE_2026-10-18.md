# Mise en service éditoriale — 18 octobre 2026

**Complément ultérieur :** 145 fiches documentaires supplémentaires créées comme brouillons sans note, migration 0076, panel mis à jour à 12:54 UTC. Inventaire : 155 lieux, dont dix publics. Voir `../editorial/documentation-2026-10-18/README.md` et ses preuves. Les nombres ci-dessous décrivent la première mise en service de 12:24 UTC.

État confirmé sur le serveur et dans le navigateur avec le compte staff Xtincell. Ce document actualise les audits du même jour, qui décrivaient l'état avant déploiement. Aucun jeton ni clé serveur dans le dépôt.

## Résultat en production

| Élément | État vérifié |
| --- | --- |
| Base PostgreSQL | Sauvegarde complète créée et archive lisible avant mutation |
| Migration | `0075_editorial_workspace`, appliquée le 18/10/2026 à 12:15:34 UTC |
| Recherche privée | 31 492 références, 31 sources : corpus initial 31 363 + 129 enrichissements |
| Enrichissement | 120 fiches `chicmenu_merchant` et neuf `business_site_enrichment` ; cuisines et liens de menus présents dans les 129 lignes |
| Attribution de l'import | Les 31 492 références sont attribuées au compte staff Xtincell |
| Profils éditoriaux | Dix brouillons factuels enregistrés ; publication du profil non forcée |
| Avis éditoriaux | Dix textes publiés sur dix lieux, compte `xtincell@gmail.com`, nom affiché Alexandre ; dates de visite de Mission 1, sous-notes non inventées |
| Carnets | Trois publiés, sept entrées sur six lieux existants, dont un carnet En duo |
| Avis fondateurs | Les trente textes et leurs attributions mobiles sont conservés |
| Lieux publics | Dix ; les nouvelles références de recherche ne sont pas automatiquement transformées en lieux publics |

Les dix textes publiés correspondent à `editorial/mission1-2026-10/reviews.json`. Ils reprennent les observations déjà attribuées publiquement à Alexandre ; ils ne créent pas de visites mobiles, de points ou de nouvelles notes communautaires. Le profil staff utilisé est actif et administrateur, identifié par `3960c617-fc75-4c7b-be3c-3440f573e390`.

Le corpus a été importé par la RPC existante sous les droits `authenticated` du compte staff, par lots de 250. Les enveloppes historiques de codes lexicaux ont été normalisées vers `analysis.aspects` lorsque nécessaire. La liste de faits admis par la RPC filtre les données ; aucun texte intégral d'avis tiers ou auteur n'est ajouté au produit.

## Panel et construction reproductible

- URL : https://admin.spawt.online
- Branche Coolify : `codex/audit-admin-commentaires`.
- Commit applicatif déployé : `c8ede0ecf288c829f738f2ca09514fb4450803e3`.
- Déploiement Coolify : `t13zbwxf7ml1dagkrl1etibn`, terminé le 18/10/2026 à 12:24:03 UTC.
- Asset public : `/assets/index-BdomXhww.js`, identique octet pour octet au build local vérifié.
- SHA-256 JavaScript : `1837a1c51663f264477bdd0238c1841132fdf2ece8338e3acb8f4156db33f66a`.

Le contexte de construction est la racine du dépôt, car l'admin importe `shared/supabase-session.ts`. `spawt-admin/Dockerfile` fixe Node 22 pour compiler puis nginx pour servir. Coolify : `build_pack=dockerfile`, `dockerfile_location=/spawt-admin/Dockerfile`, `base_directory=/`, `is_static=false`, port 80. Les deux variables publiques `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` restent fournies au build ; aucune clé serveur dans l'image web.

Deux essais de construction ont été arrêtés avant la bascule : détection Nixpacks sans npm, puis enveloppe statique Coolify recherchant `/app/spawt-admin/dist` dans l'image nginx finale. Le Dockerfile explicite et la désactivation de cette seconde enveloppe corrigent les causes. L'ancienne application est restée servie jusqu'au rolling update réussi.

## Vérifications réelles

Navigateur Chromium, 1440 × 1100, session réelle Xtincell, backend réel :

1. Liste Lieux : compteur « Avis communautaires » et lien vers les textes.
2. Lien de Kaiten : trois avis fondateurs lus dans Modération.
3. Rédaction de Kaiten : brouillon et avis éditorial publié sous Alexandre visibles.
4. Recherche : lignes importées consultables sous session staff.
5. Explore : carnets publiés présents.

Ces cinq contrôles passent, sans erreur JavaScript ni réponse REST en erreur. Captures et reçus sont conservés dans l'espace de travail privé de la session ; ils utilisent les données et le serveur réels, sans backend simulé. Les routes profondes du panel répondent en HTTP 200.

Les lectures anonymes des tables de recherche et des brouillons ne retournent aucune ligne ; la vue éditoriale publique retourne les dix textes. Les lectures staff confirment le total de recherche, les textes et les carnets.

Le parcours SQL des commentaires mobiles a été exercé sur la base réelle sous les droits du profil mobile Alexandre : insertion avec texte et cuisine/cadre/service 5/4/4, lecture dans `public_reviews` avec moyenne 4,3, puis modification du texte. La transaction est annulée ; contrôle final : zéro ligne de diagnostic persistante. Cette vérification valide les champs et les droits serveur, sans remplacer une recette de l'app installée sur le téléphone.

## Ce que le serveur contient pour les commentaires mobiles

La base contient trois spawts mobiles hors fondateurs : deux avis notés de Steph chez Madame Antika et une visite sans note chez L'Impasse. Aucun des trois ne contient de texte. Les neuf contributions du quiz n'ont pas non plus de note libre. Aucun commentaire perdu n'a donc été retrouvé dans ces tables.

Le serveur accepte les écritures testées. Pour diagnostiquer un texte resté sur un appareil, il faut encore identifier le build, le compte, le lieu et l'état local de l'envoi. Aucun nouveau build mobile, OTA ou déploiement de l'aperçu démo n'a été effectué. Le lecteur éditorial et les carnets duo nécessitent une version mobile compatible, telle que le build 32 déjà livré.

## Sauvegarde et reprise

Archive PostgreSQL sur le volume persistant : `/var/lib/postgresql/data/spawt-backups/before-editorial-20261018.dump`. Format pg_dump CUSTOM, PostgreSQL 15.8, 903 683 octets, 1 570 entrées au catalogue. Une copie privée locale a été reçue et son SHA-256 vérifié : `d45fa4d821e7ff1286ab2864a2a80267c7726780167ef3c3327afca0b3ab899c`.

Configuration admin précédente : Nixpacks, branche `codex/audit-avant-compilation`, commit `1735137440a94eb112cfd20b30f536492e988223`, base `/spawt-admin`, publication `/dist`. Le retour de console est distinct d'un rollback de schéma. Exporter les nouvelles données avant toute utilisation du `.down.sql` 0075 ; aucune procédure de retour arrière n'a été exécutée.
