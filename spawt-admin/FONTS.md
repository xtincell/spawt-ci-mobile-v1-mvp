# Polices — le piège Gotham (métriques verticales à zéro)

## Le symptôme

La console s'affichait « sans mise en forme » : titre et sous-titre superposés,
libellés écrasés sur leurs champs, boutons aplatis. Le serveur répondait 200 sur
tous les fichiers, la CSS était bien appliquée, le JS s'exécutait sans une seule
erreur. Rien, dans la console du navigateur ou l'onglet réseau, ne signalait quoi
que ce soit.

## La cause

Les six `Gotham-*.ttf` du projet ont une table **`hhea` entièrement à zéro** :

```
hhea.ascender = 0    hhea.descender = 0    hhea.lineGap = 0
```

Ces trois valeurs sont les métriques verticales de la police. Avec
`line-height: normal`, le moteur de rendu calcule la hauteur d'une ligne comme
`(ascender - descender + lineGap) / unitsPerEm` — soit **0** ici.

Conséquence : tout texte composé en Gotham se **peint** normalement mais
n'**occupe** aucune hauteur. Les blocs s'effondrent, se chevauchent, et la page
paraît ne pas avoir de CSS alors que la CSS va parfaitement bien.

La table `OS/2` du même fichier, elle, est correcte (`sTypoAscender: 730`,
`usWinAscent: 907`…). Mais **Blink — Chrome, Edge, Electron — et Android lisent
`hhea` en priorité sur `OS/2` pour une TrueType.** D'où un défaut qui ne se voit
que sur ces moteurs.

Origine : la conversion OTF → TTF de la fonte. Les `Gotham-*.otf` d'origine
(`documentation/ux/uploads/fonts/Gotham-Font/`) sont **sains** — c'est le
convertisseur qui a vidé la table.

## Pourquoi c'est resté invisible si longtemps

Trois raisons qui se renforcent :

1. **Aucune erreur.** Le fichier est un TrueType valide, correctement servi,
   correctement chargé. `document.fonts.status` vaut `loaded`.
2. **Le rendu est correct partout où la police n'est pas appliquée.** En
   environnement de test sans réseau sortant, le `@font-face` échoue, la page
   retombe sur Arial — dont les métriques sont bonnes — et **tout paraît normal**.
   Un test automatisé isolé du réseau valide donc une page qui est cassée en
   production. C'est ce qui a fait diagnostiquer trois fois de suite un problème
   de cache.
3. Le symptôme (« page mal formatée ») ressemble trait pour trait à un
   `index.html` périmé pointant vers des assets disparus — voir `NGINX.md`.

## Le correctif

`scripts/fix-font-metrics.py` réécrit `hhea` à partir des métriques
`usWinAscent`/`usWinDescent` de la table `OS/2` du fichier lui-même. Par
construction, ces valeurs bornent l'encre de la police : aucun accent ne peut
être rogné — ce qui compte, le produit étant en français.

Validation indépendante : le `Gotham-Bold.ttf` ainsi recalculé donne
`hhea = 932 / -173 / 0`, soit **exactement** la table `hhea` du
`Gotham-Bold.otf` d'origine du fondeur. Les valeurs déduites reproduisent donc
l'intention de l'auteur de la police, elles ne sont pas un réglage arbitraire.

Les sommes de contrôle (table `hhea` et `head.checkSumAdjustment`) sont
recalculées : certains chargeurs de polices mobiles les vérifient.

```bash
python3 spawt-admin/scripts/fix-font-metrics.py --verifier chemin/vers/*.ttf   # audit
python3 spawt-admin/scripts/fix-font-metrics.py chemin/vers/*.ttf             # réparation
```

En complément, `layout.css` fixe un `line-height: 1.5` explicite sur `body`.
Les polices sont réparées, mais on ne redonne pas à un binaire le pouvoir de
casser la mise en page.

## Vérifier en une ligne, dans un vrai navigateur

Une police saine mesure ~1,07 em de haut. Une police atteinte mesure 0.

```js
const d = document.createElement('div');
d.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;line-height:normal;font-family:Gotham';
d.textContent = 'Été'; document.body.appendChild(d);
console.log(d.getBoundingClientRect().height);  // 107 = sain · 0 = cassé
```

## État des exemplaires du dépôt

Tous les Gotham TTF suivis par git sont réparés (audit : 0 atteint) :

| Emplacement | Ce qu'il alimente | État |
|---|---|---|
| `spawt-admin/src/assets/fonts/` | console admin | **réparé** |
| `app/src/theme/fonts/` | l'app mobile, donc l'APK | **réparé** |
| `documentation/ux/fonts/` | brandbook UX | **réparé** |
| `documentation/ux/uploads/fonts/Gotham-Font/*.ttf` | archive — conversions TTF | **réparé** (c'était la source de la contamination) |
| `documentation/ux/uploads/fonts/Gotham-Font/*.otf` | archive — originaux du fondeur | sains d'origine, intouchés |

Côté app, l'impact visuel est volontairement minime : le design system
(`app/src/theme/tokens.ts`) épingle un `lineHeight` pré-calculé sur chaque
variante typographique, donc les hauteurs de blocs ne bougent pas. La
réparation corrige ce qu'Android dérive des métriques du fichier — placement
de la ligne de base, `includeFontPadding`, rognage des accents. Un coup d'œil
aux écrans denses (fiche lieu, Palais) sur le prochain APK suffit.

Les `.otf` Klinsman sont sains partout ; ne pas y toucher.

Garde-fou : `npm test` (suite admin) audite désormais les six polices de la
console et échoue si une police aux métriques nulles revient dans le dépôt.
