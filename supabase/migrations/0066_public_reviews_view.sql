-- ============================================================================
-- Migration 0066 — les avis publics passent par une vue, plus par la table
-- ============================================================================
-- Trouvé en passe adversariale : sondage de chaque table que l'app interroge,
-- avec la clé `anon` — celle qui est dans tous les binaires par conception.
--
-- `spawt_checkin_select_published_reviews` (0021) accorde à `anon` la lecture
-- de tout avis noté et non supprimé. L'intention est juste : les avis sont
-- publics, la fiche lieu les affiche. Le problème est ailleurs — **la RLS
-- filtre des LIGNES, pas des COLONNES**. La policy ouvre donc les 30 colonnes
-- de la table, dont :
--
--     spawter_id · geolocation_lat · geolocation_lng · arrived_at
--
-- Autrement dit : qui, où, quand. Un historique de déplacements interrogeable
-- par n'importe qui, sans compte, avec une clé publiée dans l'APK.
--
-- ── Pourquoi ce n'était pas visible ─────────────────────────────────────────
-- Aujourd'hui aucun spawt ne porte de coordonnées : les 30 avis en base sont
-- les avis fondateurs, saisis à la main (`geolocation_source = 'manual'`). Le
-- trou est LATENT — il s'ouvre au premier avis posté depuis Le Guet, c'est-à-
-- dire au premier vrai usage. Un audit qui regarde les données existantes ne
-- le voit pas ; il faut regarder la policy.
--
-- ── Le correctif ────────────────────────────────────────────────────────────
-- Une vue `public_reviews` qui ne porte QUE ce qu'un lecteur anonyme doit
-- voir, avec `security_invoker = false` pour qu'elle traverse la RLS de la
-- table — même schéma que `spawters_public` (0021). La policy trop large est
-- retirée : la table redevient « sa propre ligne, ou staff ».
--
-- La vue fait aussi la jointure vers le profil public, donc l'app lit une
-- seule surface plate au lieu d'une table + une relation embarquée. Un
-- aplatissement en moins, une jointure PostgREST en moins.
--
-- ⚠️ `security_invoker = false` fait que la vue s'exécute avec les droits de
-- son propriétaire : la sélection de colonnes ci-dessous EST le contrôle
-- d'accès. Ne jamais y ajouter une colonne sans se demander si un inconnu
-- peut la lire.
-- Date : 2026-07-29

DROP VIEW IF EXISTS public.public_reviews;

CREATE VIEW public.public_reviews
  WITH (security_invoker = false)
AS
  SELECT
    sc.id,
    sc.place_id,
    -- `spawter_id` reste exposé : l'app en a besoin pour savoir si un avis est
    -- le sien (bouton « modifier ») et pour dédupliquer. C'est un identifiant
    -- opaque, déjà porté par `spawters_public`. Ce qui ne sort pas, c'est ce
    -- qu'on ne peut pas relier à un identifiant sans le compromettre : la
    -- position et l'horodatage de passage.
    sc.spawter_id,
    sc.note_etoiles,
    sc.texte_avis,
    sc.photos,
    sc.tags,
    sc.is_seed,
    sc.created_at,
    sp.display_name,
    sp.avatar_url,
    sp.stade
  FROM public.spawt_checkin sc
  JOIN public.spawters sp ON sp.id = sc.spawter_id
 WHERE sc.note_etoiles IS NOT NULL
   AND sc.deleted_at IS NULL
   AND sc.is_cancelled = false;

COMMENT ON VIEW public.public_reviews IS
  'Avis affichables publiquement sur une fiche lieu. Colonnes choisies : ni '
  'position, ni horodatage de passage, ni champs anti-fraude. Remplace une '
  'policy qui ouvrait les 30 colonnes de spawt_checkin à `anon` — la RLS '
  'filtre des lignes, pas des colonnes. security_invoker=false : cette liste '
  'de colonnes EST le contrôle d''accès.';

GRANT SELECT ON public.public_reviews TO anon, authenticated;

-- ━━━ La table redevient privée ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Restent : sa propre ligne (spawt_checkin_select_own) et le staff
-- (spawt_checkin_select_staff). Plus rien pour `anon`.
DROP POLICY IF EXISTS spawt_checkin_select_published_reviews ON public.spawt_checkin;
REVOKE ALL ON public.spawt_checkin FROM anon;

COMMENT ON TABLE public.spawt_checkin IS
  'Spawts et avis. Contient la POSITION du spawter et l''horodatage de son '
  'passage : ne jamais rouvrir cette table à `anon`. Les avis publics passent '
  'par la vue `public_reviews` (0066).';
