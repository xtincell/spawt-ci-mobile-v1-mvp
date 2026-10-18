# Dix textes éditoriaux de Mission 1

État : préparés le 18 octobre 2026, **non publiés**.

`reviews.json` contient un texte par lieu, repris sans réécriture de `supabase/seed/founder_reviews_mission1.sql`. Le texte et son attribution publique à Alexandre ont été vérifiés sur l'API en ligne. La date de visite vient du fichier terrain, pas de la date d'import.

Après application de 0075 et déploiement de l'espace éditorial, vérifier `current_staff()` avec le compte nominatif Xtincell (`xtincell@gmail.com`), puis saisir les avis avec `save_editorial_review`. Les identifiants déterministes permettent de reconnaître la même préparation ; vérifier l'existant avant insertion et ne pas écraser une révision plus récente. Les trois sous-notes restent nulles : elles n'ont pas été relevées dans ces textes.

Les trente avis fondateurs existants restent consultables. Ces dix textes n'ont pas encore de ligne dans `place_editorial_reviews`. Le compte staff et le profil mobile sont distincts. Aucun avis communautaire ni passage géolocalisé n'est créé par ce dossier.
