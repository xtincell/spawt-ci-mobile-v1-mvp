---
name: spawt-guet
description: 'Architecture du Guet (spawt automatique géolocalisé) : machine à états, fichiers, règles métier, câblage. Use when working on geofencing, check-in flow, guet notifications, or spawt verification.'
---

# Le Guet — mécanique signature de SPAWT

Le Guet = le chat "fait le guet" : détection passive de présence dans un lieu, puis invitation discrète à spawter. Jamais d'interruption pendant le repas.

## Règles métier (PRD, verrouillées)

- Périmètre de détection : **10 m** du lieu.
- Timer : **15 min** de présence avant notification ("Comment c'était chez [NOM] ?").
- Snooze : reportable 15 min, **max 3 fois**.
- Fenêtre post-sortie : **30 min** pour noter après avoir quitté la zone.
- Sans réponse → **spawt passif** : présence enregistrée sans note, poids **0.5x**.
- Anti-fraude SQL (migration `0012`) : 1 spawt/4h/même lieu, 5/jour, vitesse >100 km/h flaggée, session <5 min avec check-in actif = suspect.

## Fichiers (`app/src/lib/guet/` et autour)

- `geofence.ts` — création/armement des régions géofence (rayon 10 m réel).
- `guet-task.ts` — task expo-task-manager background (enregistrée dans `app/app/_layout.tsx`).
- `guet-notifications.ts` — notifications locales (timer 15 min réel), canaux Android.
- `guet-permissions.ts` — demande de permissions localisation (foreground puis background).
- `guet-spawt-actions.ts` — actions de spawt (confirmer, snooze, passif).
- `app/src/components/GuetIndicator.tsx` — indicateur sticky dans `(tabs)/_layout.tsx`.
- `app/app/(tabs)/spawter.tsx` — check-in **manuel** foreground ("Je spawt ici") : le fallback qui marche déjà.
- Offline : queue de spawts hors-ligne (`OfflineQueueInspector.tsx`, sync au retour réseau).

## État au début du chantier MVP (2026-07-01)

Tous les blocs existent et sont testés unitairement, **mais `armGuet()` n'était appelé nulle part** : pipeline jamais orchestré bout-en-bout. Story 4.2 note "wire end-to-end timer 15min reporté PASS 2" — PASS 2 jamais fait. Feature flag `guet-geofence` activé seulement `internal`/`alpha` (`supabase/seed/feature_flags_guet.sql`).

## Design du câblage (chantier MVP, tâche #3)

1. **Armement** : après onboarding complet + permission background accordée → sélectionner les N lieux les plus proches (limite iOS : 20 régions max par app) → `armGuet()`. Ré-armer quand la position change significativement (significant location change) et au foreground de l'app.
2. **Entrée en zone** → timestamp `arrived_at` local ; timer 15 min (notification programmée, annulée si sortie avant).
3. **Notification** → deep link vers flux de confirmation (spawter/review) ; boutons snooze.
4. **Sortie de zone** → si pas de réponse, fenêtre 30 min puis enregistrement spawt passif via `guet-spawt-actions`.
5. **Dégradés** : permission refusée → mode manuel silencieux (pas de nag) ; batterie faible/OS agressif (Tecno/Infinix) → documenté, geofences persistent au niveau OS ; Expo Go → feature désactivée proprement (pas de crash).

## Contraintes de test

- Geofencing background **impossible dans Expo Go** — valider en dev build / APK preview.
- Simuler : jest pour l'orchestrateur (machine à états pure, mockée), test device réel pour la boucle complète (matrice 4 devices = sign-off humain).
