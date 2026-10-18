# Dix textes éditoriaux de Mission 1

État : **dix textes publiés le 18 octobre 2026** sous le compte staff Xtincell (`xtincell@gmail.com`, affiché Alexandre). Voir `documentation/MISE_EN_SERVICE_EDITORIALE_2026-10-18.md` pour les vérifications.

`reviews.json` contient un texte par lieu, repris sans réécriture de `supabase/seed/founder_reviews_mission1.sql`. Le texte et son attribution publique à Alexandre ont été vérifiés sur l'API en ligne. La date de visite vient du fichier terrain, pas de la date d'import.

La publication a utilisé `save_editorial_review` sous les droits du compte nominatif Xtincell (`xtincell@gmail.com`), confirmé par `current_staff()` dans une session réelle. Les identifiants déterministes permettent de reconnaître la même préparation ; vérifier l'existant avant toute reprise et ne pas écraser une révision plus récente. Les trois sous-notes restent nulles : elles n'ont pas été relevées dans ces textes.

Les trente avis fondateurs existants restent consultables. Les dix identifiants du JSON ont leur ligne publiée dans `place_editorial_reviews`. Le compte staff et le profil mobile sont distincts. Aucun avis communautaire ni passage géolocalisé n'est créé par ce dossier.
