-- Down 0054 — retire la réversibilité de l'amorçage.
-- ⚠️ Après ce rollback, les compteurs `place_adn.total_reviews` ne peuvent plus
-- redescendre : supprimer un avis laissera son nombre affiché. Ne jouer ce
-- rollback que pour revenir au comportement 0025, en connaissance de cause.

DROP TRIGGER IF EXISTS trg_recompute_place_adn_note_edit  ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_recompute_place_adn_softdelete ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_recompute_place_adn_delete     ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.recompute_place_adn_on_removal();
DROP FUNCTION IF EXISTS public.purge_seed_reviews(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.recompute_place_adn_full(UUID);

ALTER TABLE public.place_adn
  DROP COLUMN IF EXISTS base_axe_local_international,
  DROP COLUMN IF EXISTS base_axe_informel_etabli,
  DROP COLUMN IF EXISTS base_axe_budget_premium,
  DROP COLUMN IF EXISTS base_axe_populaire_prive,
  DROP COLUMN IF EXISTS base_axe_decontracte_habille;

ALTER TABLE public.spawt_checkin DROP CONSTRAINT IF EXISTS spawt_checkin_seed_batch_coherent;
DROP INDEX IF EXISTS public.idx_spawt_checkin_seed_batch;
ALTER TABLE public.spawt_checkin DROP COLUMN IF EXISTS seed_batch_id;

DROP INDEX IF EXISTS public.idx_spawters_is_seed;
ALTER TABLE public.spawters DROP COLUMN IF EXISTS is_seed;

-- L'action de purge sort du journal d'audit (les lignes déjà écrites
-- resteraient en violation : on les retire d'abord).
DELETE FROM public.admin_audit_log WHERE action = 'seed_reviews_purge';
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'login','login_failed','place_create','place_update','place_delete',
    'place_publish_toggle','place_adn_update','review_keep','review_delete',
    'review_warning','report_kept','report_removed','report_warned',
    'spawter_warning','spawter_ban','spawter_unban','seed_inventory_run',
    'push_campaign','event_create','event_update','event_delete',
    'promo_create','promo_update','promo_delete','challenge_create',
    'challenge_update','suggestion_approve','suggestion_reject','b2b_link',
    'b2b_unlink','flag_update','explore_create','explore_update',
    'explore_delete','explore_publish','explore_unpublish'
  ]));
