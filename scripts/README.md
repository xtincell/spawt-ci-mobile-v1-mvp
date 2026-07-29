# scripts/ — Outillage racine du repo

## `conformity-check.mjs` — conformité cahier (boucle adversariale)

```bash
node scripts/conformity-check.mjs
```

Vérifie mécaniquement que le repo tient les promesses de la version finale.
Node ≥ 18, **zéro dépendance** (mini-parseur YAML embarqué pour le
sous-ensemble utilisé par la checklist).

- **Entrée** : `documentation/conformity-checklist.yaml` — 37 features
  (19 MVP PRD §3.1 + 18 post-MVP §4.1, Podcast marqué exclu par design) +
  sections `note_maj` (textes exacts R2/R5/R26…, code OTP `123456`, purge
  « on » R13), `contrat_spawt` (pas de `spawter_id` dans `challenge_progress`,
  pas de vocab compétition — scanne AUSSI `fr.json`, angle mort de
  `lint:vocab`), `da` (aucun hex hors `app/src/theme/tokens.ts`),
  `enveloppe` (deps natives figées, placeholders `eas.json`).
- **Types d'assertions** : `files` (existence), `symbols` (`chemin#export`),
  `migrations` (`NNNN` + `.down.sql` apparié), `i18n` (clé pointée de
  `fr.json`), `flags` (flag_code dans `supabase/seed/*.sql`), `deps`
  (`app/package.json`), `absent_pattern` (regex qui ne doit PAS matcher),
  vérifs dédiées (`no_on_pronoun`, `sql_table_lacks_column`, `hex_scan`,
  `eas_submit`).
- **Sortie** : rapport groupé par feature/section — ✅ conforme,
  ❌ écart bloquant, ⚠️ écart attendu (`expected_pending: true`, ex. les
  identifiants stores `REMPLACER_*` de `eas.json` tant que les comptes
  n'existent pas).
- **Code de sortie** : `1` dès qu'un ❌ subsiste ; les ⚠️ ne cassent pas.

Branché en CI dans `.github/workflows/eas-build.yml` (étape « Conformité
cahier », après la triple gate) : aucun build distribué si un ❌ apparaît.

### Maintenir la checklist

La checklist doit rester **vraie** ou révéler un **vrai trou** — jamais
« verte par complaisance ». Quand un ❌ apparaît :

1. **Vrai trou** → corriger le code (petit correctif) ou le documenter
   (gros chantier) — pas la checklist.
2. **Assertion périmée** (fichier renommé, clé i18n déplacée…) → recalibrer
   l'assertion en citant la nouvelle preuve.
3. **Écart connu et assumé** → `expected_pending: true` + `note:` datée,
   jamais de suppression silencieuse.

Nouvelle feature = nouvelle entrée avec au minimum un `files:`/`symbols:` et
sa migration si elle touche la base. Audit d'origine :
`documentation/AUDIT_NOTE_MAJ_R1-R28.md`.
