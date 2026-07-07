# SPAWT — 2 décisions produit à trancher (MAJ consolidée, 07/07/2026)

Ces deux points sont **implémentés mais paramétrables** : le build 6 tourne, mais
la « bonne réponse » relève du produit/data, pas du code. Rien ne bloque le
build ; on a juste besoin de la décision pour figer le comportement final.

---

## Q4 — Comment on produit le « prix moyen » (F CFA) ? → **Kidam (data)**

**Ce qui est déjà fait.** La fiche lieu affiche « ~N F CFA » à la place de
l'échelle ₣/₣₣/₣₣₣ (demande R21). Le chiffre est lu dans une colonne dédiée
(`avg_ticket_xof`). **Ce qui manque : d'où sort ce chiffre et ce qu'il
représente exactement.** On n'a rien inventé côté code — on attend la méthode.

**La décision.** Deux sous-questions :

**A) La source du chiffre :**
1. **Éditorial / saisi par l'équipe** (RECO) — un membre de l'équipe renseigne le
   prix dans le dashboard admin depuis le menu du lieu. Dispo dès le lancement
   (zéro donnée requise), contrôlable, cohérent avec le secteur.
2. **Crowdsourcé** — on demande au spawter « t'as payé combien ? » et on prend la
   médiane. Vivant et gratuit en main d'œuvre, mais inutilisable au lancement
   (aucune donnée), biaisé au début, déclaratif peu fiable, friction en plus.
3. **Auto depuis le menu** — non viable : nos menus sont des **photos**, pas des
   prix structurés.

> **Reco : (1) au lancement**, puis basculer/recouper avec (2) la médiane
> crowdsourcée dès qu'on a du volume de spawts (Kidam fixe le seuil, ex. ≥ 20
> spawts avec montant). C'est exactement la posture de TheFork (chiffre éditorial)
> + notre avantage communautaire plus tard.

**B) La convention de calcul (le vrai arbitrage de Kidam) :**
- **Quoi** : prix d'**un repas type, par personne** = plat principal +
  accompagnement/entrée (l'équivalent local du « entrée + plat » de TheFork).
- **Boissons** : les inclure ou pas ? TheFork **exclut** les boissons. Mais au
  maquis/garba, la boisson (bière, bissap) pèse lourd dans l'addition réelle.
  - **Reco : hors boissons** (comparable d'un lieu à l'autre, plus stable), avec
    la mention « boissons non comprises » affichée sous le prix pour rester
    honnête. Alternative : inclure une boisson standard (plus fidèle au ressenti
    local, moins comparable).
- **Format** : un seul chiffre médian par lieu (pas une fourchette), rafraîchi
  périodiquement.

**Ce qu'a fait TheFork (LaFourchette), pour référence.** Prix moyen = une
combinaison type (entrée + plat, ou plat + dessert), **boissons exclues** ; la
valeur est **fournie par le restaurant / éditoriale**, pas une moyenne des
tickets réels ; affichée en valeur concrète (ex. « 35 € ») + une échelle
€/€€/€€€ juste comme filtre. → Le plus proche de notre besoin = **option A-1 +
convention B « hors boissons »**.

---

## R3 — Garde-t-on le champ « Pays d'origine » à l'inscription ? → **Stephanie (produit)**

**Ce qui est déjà fait.** L'onboarding demande deux pays : **Pays de résidence**
(utile — localise les lieux) et **Pays d'origine** (justifié par « d'où tu viens
aide à te proposer ce que tu pourrais aimer »). Les deux sont passés en listes
déroulantes (R3). La question posée dans la note : **on garde « Pays
d'origine » ou pas ?**

**Ce qui pèse dans la balance :**
- Le calibrage mesure **déjà** un axe « Racines ↔ Horizons » (garba/placali vs
  burger/ramen) de façon **comportementale et plus fiable** → le pays d'origine
  est en partie **redondant** avec un signal qu'on capte mieux autrement.
- Chaque champ d'onboarding **coûte de l'activation** (le KPI funnel de Kidam).
- C'est de la **donnée personnelle** → exposition ARTCI (loi 2013-450).
- **Mais** il y a une vraie thèse de marque « nostalgie / racines » (les
  archétypes du quiz — Mémoire, Nostalgique… — jouent là-dessus). D'où : c'est
  ton appel, pas le mien.

**Les options :**
1. **Retirer** (RECO) — l'axe Racines↔Horizons fait déjà le job ; on gagne en
   activation et on réduit le PII, pour un signal faible et redondant.
2. **Garder mais sortir de l'onboarding** — le déplacer en optionnel dans le
   profil, hors du flux d'inscription critique. Bon compromis si tu tiens à
   l'angle nostalgie.
3. **Garder à l'inscription** (statu quo) — si « SPAWT connaît tes racines » est
   central à la marque et qu'on assume la friction.

> **Reco : (1) retirer pour le lancement**, ou (2) si tu veux préserver l'angle
> nostalgie sans plomber l'activation. Dans tous les cas on **garde la colonne en
> base** (coût nul, réversible plus tard).

**Ce qu'a fait TheFork, pour référence.** Rien : une plateforme de réservation
demande le strict minimum (nom, téléphone, nombre de couverts) — **aucune donnée
d'origine**. La friction d'inscription est traitée comme l'ennemie de la
conversion.

---

### En une ligne pour le groupe
- **Q4 (Kidam)** : prix moyen = on le **saisit à la main depuis le menu** (comme
  TheFork), repas type par personne **hors boissons** ? Puis médiane
  communautaire quand on aura du volume ?
- **R3 (Stephanie)** : on **retire « Pays d'origine »** de l'inscription (l'axe
  Racines↔Horizons le capte déjà), ou on le garde ?
