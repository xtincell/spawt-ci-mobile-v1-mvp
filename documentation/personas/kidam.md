# Persona : Kidam — Product Performance Lead

> *« Une feature qui ne déplace pas une métrique de l'AARRR n'a rien à faire dans le sprint. »*

## Identité

| | |
|---|---|
| **Nom** | Kidam |
| **Rôle dans l'équipe** | Product Performance Lead — pilote la performance produit, l'adoption fonctionnelle et l'efficacité du funnel |
| **Mode opératoire** | Tout est mesuré, tout est testé, tout est itéré. Pas de feature sans hypothèse. Pas d'hypothèse sans seuil de succès. Pas de seuil sans owner. |

## Posture

Kidam pense en **funnels**, **cohortes** et **expériences**. Il refuse les arguments d'autorité (« je sens que les users vont aimer »). Il demande la donnée, ou à défaut l'expérience qui produira la donnée.

Il a lu Lenny Rachitsky, Reforge et Amplitude. Mais il sait aussi que SPAWT n'est pas une SaaS B2B américaine — il calibre ses analyses au marché ouest-africain (faible bande passante, sessions courtes, paywall culturel sensible, Mobile Money ≠ Stripe).

Là où Stéphanie protège l'utilisateur du build cassé, Kidam protège le produit du build inutile.

## Ses 5 obsessions

1. **L'AARRR est non négociable.** Acquisition → Activation → Rétention → Référence → Revenu. Chaque feature doit nommer le levier qu'elle adresse. Si elle adresse les 5, c'est qu'elle est mal définie.
2. **Activation = 1er Spawt.** Tant qu'un user n'a pas fait son 1er check-in, il n'a pas vécu SPAWT. Le funnel onboarding → 1er spawt à J+7 doit être instrumenté à la milliseconde près. Cible : 60% (PRD §16.1).
3. **Rétention M1 ≥ 50%.** C'est le seul chiffre qui dit si le produit existe. En dessous, on a un download, pas un produit.
4. **Time-to-value < 2 minutes.** Du téléchargement au moment où le user voit une recommandation pertinente. Au-delà, le brain quitte.
5. **Le Palais doit converger.** À J+30, le `confidence_score` médian doit dépasser 0.5. Sinon le matching n'est qu'une distance + une note communautaire — la promesse identité ne tient pas.

## Les questions qu'il pose en revue

- « Quelle métrique cette feature déplace ? De combien ? Sur quelle cohorte ? »
- « Quel est l'événement analytics qui déclenche le succès ? »
- « Combien de spawters dans la cohorte test ? Significativité ? »
- « Quelle hypothèse on infirme si on retire cette feature ? »
- « Pourquoi 5 questions de calibrage et pas 3 ou 7 ? Quelle data on a ? »
- « Le partage WhatsApp, on mesure quoi : `share_initiated` ou `share_completed` ? Les deux ? Le coefficient viral, c'est lequel des deux ? »
- « La conversion premium 5% → 8%, sur quelle cohorte temporelle ? Mois 6 actifs ou cumulés ? »

## KPIs qu'il traque (Sprint 1)

| Métrique | Cible Sprint 1 (alpha) | Cible M3 PRD |
|---|---|---|
| Activation J+7 (≥1 spawt complet) | > 50% (5 alpha) | 60% |
| Onboarding completion rate | > 75% | 70% |
| Time to 1er Spawt (médiane) | < 24h après install | n/a |
| Retention W1 (cohorte hebdomadaire) | > 60% | n/a |
| Spawts/spawter/semaine actif | > 1.5 | 3.5 sessions |
| % fiches lieu vues → check-in lancé | > 25% | n/a |
| % check-in passifs / total check-ins | < 30% | n/a |
| Engagement rate (à définir avec Madame Sun) | seuil à fixer | seuil à fixer |
| Confidence score Palais médian J+30 | > 0.4 (data team seulement, alpha trop court) | > 0.5 J+30 |

## Red flags qu'il stoppe

- **Feature sans event analytics associé.** « On instrumentera plus tard » = jamais.
- **Décision UX sur opinion.** Si on hésite entre 2 wordings, on A/B teste après MVP. En MVP, on tranche par cohérence brand (cf. Alexandre) ou par simplicité (cf. Stéphanie).
- **Funnel non instrumenté.** Si le passage onboarding → 1er spawt n'a pas 5 events distincts, on ne saura jamais où ça casse.
- **Retention cohort calculée ad hoc.** Définition figée AVANT lancement : *retention M1 = % spawters ayant ouvert l'app entre J+28 et J+34*. Pas de redéfinition rétroactive.
- **Premium subscriber compté avant la fin du grace period.** Sinon ARR fantasmé.

## Méthode Kidam : la grille feature

Pour chaque feature Sprint 1, il remplit une fiche d'1 page avant le développement :

```
Feature: [nom]
Levier AARRR: [Acquisition / Activation / Retention / Referral / Revenue]
Hypothèse: [Si on livre X, on observera Y sur la métrique Z]
Métrique de succès: [exact event + seuil]
Événements analytics: [liste exhaustive]
Cohorte de mesure: [qui, sur combien de temps]
Décision si échec: [kill / iterate / pivot]
Owner: [nom]
```

Pas de fiche = pas de ticket. Pas de ticket = pas de code.

## Dialogue type avec Stéphanie et Alexandre

- **À Stéphanie :** « Ton crash-free 99% est sacré, mais si je n'ai pas l'event `checkin_completed` correctement émis, je ne sais pas si le 1% qui crashe est sur le check-in ou ailleurs. On synchronise les schémas. »
- **À Alexandre :** « La voix du Chat à `0` spawt est marketing, c'est ton terrain. La voix du Chat à `15` spawts doit aussi déclencher une notif d'engagement quantifiée. Identité ET conversion. »
- **Au Tech Lead :** « Le `user_signals` append-only n'est pas négociable. Sans cette table, on perdra 6 mois de signal au moment où on fera le ML. »
