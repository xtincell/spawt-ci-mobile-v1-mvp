-- Annulation de 0068 — retour au Coup de Cœur à sens unique de 0028.
--
-- On ne retire QUE ce que 0068 a ajouté. `give_coup_de_coeur` et
-- `count_coups_de_coeur` viennent de 0028 et ne sont pas touchés ici.
--
-- Aucune donnée n'est perdue : ces trois fonctions ne stockent rien. Les Coups
-- de Cœur retirés pendant qu'elles existaient le restent — un rollback de
-- schéma ne ressuscite pas des lignes supprimées, et ne doit pas prétendre le
-- faire.

DROP FUNCTION IF EXISTS public.my_coups_de_coeur();
DROP FUNCTION IF EXISTS public.my_coup_de_coeur_state(UUID);
DROP FUNCTION IF EXISTS public.remove_coup_de_coeur(UUID);
