# SPAWT — Checklist humaine (la part de l'équipe)

Ce que la tech ne peut pas faire à votre place. Classé par urgence. Cochez et datez.

## Bloquant pour les builds iOS

- [ ] **Compte Apple Developer Program** (99 USD/an) — sans lui : aucun build device iOS, pas de TestFlight. Une fois créé : Team ID + créer l'app `com.upgraders.spawt` dans App Store Connect (ascAppId) + clé API App Store Connect pour EAS submit. Renseigner dans `app/eas.json` (`submit.production.ios`).
- [ ] Vérifier que le compte Expo `xtincell` a accès aux credentials iOS (EAS gérera certificats/profils automatiquement une fois le compte Apple lié : `eas credentials`).

## Bloquant pour un OTP réel (inscription par SMS)

- [ ] **Compte Termii** (provider SMS local) → récupérer `TERMII_API_KEY`.
- [ ] Configurer les secrets Supabase (projet `ucymjsxmnzdxvvupgaof`) : `TERMII_API_KEY`, `MOCK_TERMII=false` (ou `true` pour beta fermée sans SMS réels), `ALLOWED_ORIGINS`.
- [ ] En attendant : mode démo OTP = code `123456` (fonctionne déjà).

## Bloquant pour la soumission aux stores (pas pour les builds)

- [ ] **Juriste** : CGU/CGV + politique de confidentialité conformes Loi ivoirienne 2013-450 (ARTCI) — marquées `[pending juriste]` dans le PRD. Héberger la politique à une URL publique (exigence Apple + Google).
- [ ] **Google Play Console** : compte développeur + service account JSON pour `eas submit` (piste interne d'abord) + formulaire Data Safety (l'app collecte : téléphone, position, photos).
- [ ] **Fiches stores** : screenshots, descriptions FR, classification d'âge.
- [ ] Déclaration ARTCI du service (Loi 2013-450).

## Qualité / observabilité

- [ ] **Sentry** : créer le projet → donner le DSN → le mettre en secret EAS (`EXPO_PUBLIC_SENTRY_DSN`). Le code est prêt et silencieux tant que le DSN est absent.
- [ ] **Matrice 4 devices** : test physique (dont un Tecno/Infinix pour le kill background Android) — protocole dans `documentation/` + stories Epic 4.
- [ ] **Triple sign-off** Stéphanie / Kidam / Alexandre sur le Sprint 1 (exigé par le DoD BMAD).

## Décisions git

- [ ] Merger la PR de finalisation MVP (branche `claude/ios-android-final-version-5vad3n`) puis décider du merge `spawt/v1-bmad` → `main`.

## Déjà en place (pour mémoire, ne pas refaire)

- Supabase live : migrations 0001→0023 + 4 Edge Functions ACTIVE.
- EAS Android : keystore managé, 3 APK alpha livrés (tags `build-android-*`).
- Secret GitHub `EXPO_TOKEN` opérationnel (la CI a déjà buildé).
