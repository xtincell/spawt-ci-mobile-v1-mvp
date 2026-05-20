# SPAWT — Taxonomie d'événements analytics

> Claude amendment 5.1 (cahier des charges Sprint 1) · Owner : Kidam · Statut : `[draft pending Madame Sun + Tech Lead]`

Source unique des événements analytics émis par l'app et le backend. Format `snake_case`. Tout event hors de cette liste = drift, à ajouter ici via PR avant d'être émis dans le code.

Provider cible (PRD §12.1) : **PostHog ou Mixpanel**. Sprint 1 instrumente la collecte ; les dashboards arrivent avec Madame Sun.

---

## Conventions

- `snake_case` strict, pas de `camelCase` ni d'espace
- Préfixé par domaine : `onboarding_*`, `feed_*`, `place_*`, `spawt_*`, `review_*`, `share_*`, `profile_*`, `auth_*`
- Toutes les propriétés snake_case également
- `spawter_id` injecté automatiquement par le wrapper analytics si dispo
- Timestamps ISO 8601 UTC

---

## 1. Acquisition

| Event | Quand | Propriétés |
|---|---|---|
| `app_first_open` | 1er lancement après install | `device_os`, `device_model`, `app_version`, `referrer` (deep link source si dispo) |
| `app_open` | Chaque ouverture (foreground) | `app_version`, `seconds_since_last_open` |

## 2. Activation — Onboarding (PRD §3.1 #2 + §16.1)

| Event | Quand | Propriétés |
|---|---|---|
| `onboarding_started` | Vue splash → tap "Entrer dans la Meute" | — |
| `consent_screen_viewed` | Affichage de l'écran consentement | — |
| `consent_recorded` | Décision sur un bloc consent (Story 2.2 / FR-040 — kind aligné CGU/CGV + géoloc, remplace l'ancien `data` legacy) | `kind` (cgv \| geoloc), `decision` (accepted \| declined) |
| `onboarding_step_completed` | Fin de chaque étape | `step` (consent \| phone \| profile \| calibration), `step_index` (1-4) |
| `calibration_answered` | Réponse à une question de calibrage | `axis` (racines_horizons \| ...), `direction` (neg \| pos \| neutral), `value` (-0.4 \| 0 \| +0.4 \| `null`), `skipped?` (boolean) |
| `onboarding_completed` | Calibration validée, spawter persisté | `country_code`, `age_range`, `gender`, `time_to_complete_seconds`, `palais_initial_dominant_axes` (array, 2 axes) |
| `onboarding_abandoned` | App fermée ou reset avant `onboarding_completed` | `last_step` |

> **`calibration_answered.value` — sémantique** (Story 2.3a Round 2 P-25 + P-33 + Round 3 DN-5)
>
> - `-0.4` / `+0.4` : carte « néga » / « posa » dominante sélectionnée par le spawter.
> - `0` : « neutral résolu » — le spawter a sélectionné un mix posa + néga (signal délibéré, contribue au confidence Palais).
> - `null` (sentinel) : skip explicite (« Pas d'avis ») — N'INCRÉMENTE PAS `answeredCount` côté confidence. `skipped: true` est émis dans la même payload pour le filtrage downstream.
>
> **Filtrage downstream Kidam** : pour mesurer la part de spawters qui skip vs répondent, filtrer sur `skipped === true`. Pour le funnel Palais, compter les events avec `value !== null` (skip exclus, neutral résolu inclus).

**Funnel cible** (PRD §16.1) : DL → app open 85% → onboarding complete 70% → 1er clic lieu 50% → 1er spawt 40% → activation J+7 60%.

## 3. Activation — Premier Spawt (PRD §16.1)

| Event | Quand | Propriétés |
|---|---|---|
| `feed_first_view` | Première arrivée sur le feed après onboarding | `places_count` |
| `place_first_view` | Première fiche lieu ouverte | `place_id`, `match_score`, `distance_km`, `time_since_onboarding_seconds` |
| `spawt_first_completed` | Premier spawt verified=true | `place_id`, `time_since_onboarding_hours` |
| `activation_j7_reached` | (cron backend) ≥1 spawt entre J+0 et J+7 | `spawts_in_window` |

## 4. Engagement — Feed & Recherche

| Event | Quand | Propriétés |
|---|---|---|
| `feed_viewed` | Affichage du feed (chaque ouverture du tab) | `places_shown`, `top_score`, `palais_confidence` |
| `feed_card_impressed` | Carte visible (FlatList onViewableItemsChanged) | `place_id`, `position`, `match_score` |
| `feed_card_clicked` | Tap sur une carte | `place_id`, `position`, `match_score`, `distance_km` |
| `feed_refreshed` | Pull-to-refresh | `places_count` |
| `search_submitted` | Requête de recherche | `query`, `filters` (object), `results_count` |
| `filter_applied` | Toggle d'un filtre | `filter_kind` (cuisine \| budget \| distance \| rating), `value` |

## 5. Engagement — Fiche lieu & ADN

| Event | Quand | Propriétés |
|---|---|---|
| `place_viewed` | Ouverture d'une fiche lieu | `place_id`, `match_score`, `referrer` (feed \| search \| map \| share \| direct) |
| `place_call_tapped` | Tap sur le téléphone | `place_id` |
| `place_whatsapp_tapped` | Tap sur WhatsApp | `place_id` |
| `place_saved` | Ajout aux favoris (PRD #9) | `place_id` |
| `place_unsaved` | Retrait des favoris | `place_id` |
| `adn_under_construction_seen` | Vue d'un radar avec confidence < 0.3 | `place_id`, `total_reviews` |

## 6. Le Guet — Mécanisme spawt (PRD §3.1 #5, §7.1)

| Event | Quand | Propriétés |
|---|---|---|
| `guet_armed` | Geofence registered pour un lieu | `place_id`, `radius_m` |
| `guet_geofence_triggered` | Entrée détectée dans le périmètre | `place_id`, `accuracy_m`, `geolocation_source` |
| `guet_threshold_reached` | 15 min de présence atteintes | `place_id`, `minutes_in_zone` |
| `guet_notification_sent` | Push "Comment c'était ?" envoyée | `place_id` |
| `spawt_notification_opened` | Tap sur la notif | `place_id`, `delay_seconds` |
| `spawt_snoozed` | Tap sur snooze | `place_id`, `snooze_count` (1-3) |
| `spawt_completed` | Spawt confirmé | `place_id`, `check_in_type` (active \| passive \| manual), `is_verified`, `session_duration_minutes`, `had_review` |
| `spawt_passive_recorded` | Présence prouvée sans confirmation | `place_id`, `session_duration_minutes` |
| `spawt_cancelled` | Cancel manuel | `place_id`, `reason` (not_here \| wrong_place \| skip) |
| `antifraud_flag_raised` | Drapeau anti-fraude posé (côté serveur ou client) | `place_id`, `flag` (frequence_meme_lieu \| frequence_globale \| ...) |

## 7. Engagement — Avis (PRD §3.1 #6)

| Event | Quand | Propriétés |
|---|---|---|
| `review_started` | Ouverture du formulaire d'avis | `place_id`, `entry_point` (post_spawt \| place_detail) |
| `review_submitted` | Avis enregistré | `place_id`, `note_etoiles`, `tags_count`, `text_length`, `photos_count` |
| `review_photo_added` | Ajout d'une photo dans le formulaire | `place_id`, `photos_count_now` |
| `review_abandoned` | Sortie sans submit | `place_id`, `had_note` |

## 8. Coup de Cœur (PRD §3.1 #12, §7.3)

| Event | Quand | Propriétés |
|---|---|---|
| `coup_de_coeur_attempted` | Tentative de pose | `place_id`, `available_count` |
| `coup_de_coeur_posted` | Posé avec succès | `place_id`, `stade`, `month_count_used` |
| `coup_de_coeur_quota_exhausted` | Vue du blocage | `place_id`, `stade` |

## 9. Identité — Stade & Palais (PRD §5)

| Event | Quand | Propriétés |
|---|---|---|
| `palais_updated` | Recalcul après spawt | `confidence_score`, `dominant_axes`, `total_spawts` |
| `stade_unlocked` | Passage à un nouveau stade | `from_stade`, `to_stade`, `unique_spots` |
| `title_displayed_changed` | Toggle d'un titre affiché parmi la collection | `from` (i18n key ou null), `to` (i18n key) |
| `profile_opened` | Ouverture de l'onglet profil | — |
| `spawter_card_flipped` | Flip de la carte spawter (recto ↔ verso) | `to` (`"recto"` ou `"verso"`) |
| `archetype_assigned` | (Sprint 2) Premier archetype attribué | `archetype_id`, `dominant_axes` |
| `archetype_mue` | (Sprint 2) Changement latéral d'archetype | `from_archetype`, `to_archetype`, `inertie_days` |

## 10. Viralité — Partage (PRD §3.1 #16)

| Event | Quand | Propriétés |
|---|---|---|
| `share_initiated` | Tap sur le bouton partager | `place_id`, `surface` (place_detail \| profile \| feed) |
| `share_completed` | Partage WhatsApp confirmé | `place_id`, `surface` |
| `share_link_opened` | (Backend) deep link entrant | `place_id`, `referrer_spawter_id` (si trackable) |

## 11. Auth & paramètres

| Event | Quand | Propriétés |
|---|---|---|
| `auth_otp_sent` | OTP envoyé via Termii (Story 2.3) | `phone_masked` (`+225 XXXXXX 12`), `resend?` (bool), `demo?` (bool si mode démo) |
| `auth_otp_validated` | OTP saisi (succès ou échec) | `method` (`"phone"`), `success` (bool), `attempts?` (number, sur échec), `demo?` (bool si mode démo) |
| `auth_signed_in` | Session JWT Supabase ouverte | `method` (`"phone" \| "google" \| "apple"`), `demo?` (bool si mode démo) |
| `auth_signed_out` | Logout | — |
| `account_reset` | Reset démo (mode fallback) | — |
| `account_deletion_requested` | Endpoint DELETE /me appelé (Claude amendment 5.2) | `reason` (optional) |

> **Note Story 2.3 (2026-05-17)** — Les propriétés `country_code` / `provider` / `attempt_count` / `is_first_login` initialement spec ne sont **pas** émises côté mobile V1. Refactor analytics : alignement Kidam sign-off requis avant dashboard funnel.

## 12. Premium / Paiement (PRD §11)

| Event | Quand | Propriétés |
|---|---|---|
| `paywall_shown` | Vue du paywall | `surface` (place_detail \| feed \| profile), `trigger` (geo \| feature_gate) |
| `subscription_initiated` | Tap sur "Devenir Gold" | `plan_id`, `surface` |
| `payment_completed` | Webhook CinetPay confirme | `plan_id`, `amount_xof`, `currency_id` |
| `subscription_renewed` | Renouvellement | `plan_id`, `cycle_n` |
| `subscription_lapsed` | Grace period dépassée → free | `plan_id`, `days_in_grace` |

---

## Métriques dérivées (formules à figer avec Madame Sun)

> Cf. cahier des charges §6 — décision ouverte. Ces formules sont des hypothèses Kidam à valider.

- **Engagement rate (hebdo)** = `(sessions × actions_clés) / (jours_actifs × spawters_actifs)` où `actions_clés ∈ {feed_card_clicked, place_viewed, spawt_completed, review_submitted, share_completed}`
- **Tx d'activation** = `count(spawter_id WHERE spawt_first_completed BETWEEN J+0 AND J+7) / count(onboarding_completed)`
- **Retention M1** = `count(distinct spawter_id WHERE app_open BETWEEN J+28 AND J+34) / count(onboarding_completed J=0)`
- **Coefficient viral** = `count(share_link_opened) / count(share_completed)`
- **Funnel cold start** : `app_first_open → onboarding_started → onboarding_completed → feed_first_view → place_first_view → spawt_first_completed`

---

## Prochaines étapes

1. ✅ Lister la taxonomie (ce document, draft)
2. ⏳ Validation Madame Sun + Tech Lead — figer les formules `[pending]`
3. ⏳ Implémenter `app/src/lib/analytics.ts` — wrapper typé qui force le respect de cette taxonomie (TypeScript impose le nom de l'event + ses propriétés via union types)
4. ⏳ Brancher le provider (PostHog ou Mixpanel) — décision pas encore prise
5. ⏳ Dashboard funnel onboarding → 1er spawt visible avant fin Sprint 1 (Kidam)
