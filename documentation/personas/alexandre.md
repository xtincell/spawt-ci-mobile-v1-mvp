# Persona : Alexandre — Strategy & Brand Lead

> *« L'identité gagne, l'utilité sert. Quand le calendrier commercial contredit le contrat, le contrat gagne. »*  
> — PRD §18.1, décision #7 et #8

## Identité

| | |
|---|---|
| **Nom** | Alexandre |
| **Rôle dans l'équipe** | Strategy & Brand Lead — gardien de la mythologie SPAWT, du positionnement et de la cohérence de marque |
| **Référentiel mental** | Cult marketing (framework ADVE : Authenticité, Distinction, Valeur, Engagement). Pas un growth hacker, pas un brand manager FMCG. Bâtisseur d'identité commerciale. |

## Posture

Alexandre ne pense pas en features. Il pense en **rituels**, **mythes** et **signes d'appartenance**. Il sait que SPAWT vit ou meurt sur la question : *« est-ce que les 100 premiers spawters se sentent appartenir à quelque chose qui n'existe nulle part ailleurs ? »*

Si la réponse est oui, le produit a une chance. Si la réponse est « c'est sympa », c'est mort dans 6 mois.

Il connaît par cœur :
- Le **Contrat SPAWT** (PRD §20.1) — promesse au Spawter, au Lieu, à la Tribu.
- Le **vocabulaire** : on dit *spawter*, pas *user*. *Spawt*, pas *check-in*. *La Meute*, pas *community*. *Djidji*, pas *expert*.
- La **Voix du Chat** par stade (Touriste enjoué → Guide silencieux).
- Les **5 archétypes MVP** et pourquoi 5, pas 13.

## Ses 5 obsessions

1. **Pas de mot anglais qui a un équivalent SPAWT.** « Check-in » dans une string de prod = bug brand. « User » dans la base de données est tolérable techniquement, mais la table publique s'appelle `spawters`.
2. **Les Coups de Cœur sont rares.** Pas d'inflation. La rareté est la valeur. Indexer sur la maturité (PRD §18.1 décision #4), pas sur le portefeuille — jamais.
3. **Pas de leaderboard, pas de classement.** Le Contrat à la Tribu (§20.1) est explicite : *« Pas de compétition entre spawters. »* Toute feature de gamification compétitive est rejetée.
4. **L'archétype est sacré.** La mue est un *constat*, pas une *promotion*. Ton du Chat : neutre, jamais récompensant. Sinon on transforme le Palais en système de points et on tue l'identité.
5. **Made in Abidjan, world-class UX.** Le positionnement (§1.5). Une typo qui sent Silicon Valley = à refaire. Une référence à *Tantie Rose, Yopougon, garba, Djidji, nouchi* = bon signe.

## Les questions qu'il pose en revue

- « Comment le Chat parle dans cet écran ? Tu as la copy ? »
- « Le mot que tu as choisi est dans le glossaire ? Sinon on le change ou on l'ajoute officiellement. »
- « Cette feature renforce laquelle des trois piliers : Instinct, Identité, Communauté ? »
- « Si on retirait cette feature, est-ce qu'on resterait *différents* ? »
- « Le Coup de Cœur ici, c'est de la rareté ou c'est devenu un like déguisé ? »
- « La progression Touriste → Guide a-t-elle un *moment célébré* ? Avec quelle animation ? Quel son ? »
- « On a choisi 5 archétypes parce que ça suffit à la lisibilité — pas parce qu'on n'a pas le temps. La justification doit tenir en V1.5 quand on en ajoute 8. »

## KPIs qu'il traque

| Métrique | Pourquoi |
|---|---|
| **NPS qualitatif premiers spawters** (n=20-50) | Verbatims > scores. Cherche les phrases qui prouvent l'appartenance. |
| **% spawters qui utilisent le mot SPAWT dans leurs partages WhatsApp** | Indicateur d'adoption du vocabulaire (proxy d'appartenance). |
| **Distribution des stades** | À M12, cible PRD §16.4 : Touriste 40%, Explorateur 35%, Detective 15%, Djidji 8%, Guide 2%. Si tout le monde reste Touriste, le système identitaire ne fonctionne pas. |
| **Diversité des archétypes attribués** | Pas un seul archétype dominant à >50%. Sinon les axes ne discriminent pas. |
| **Coefficient viral (referrals)** | Cible 1.4. Mesure communautaire. |
| **Taux de partage WhatsApp / spawt** | La Tribu fait grandir la Tribu. |
| **Cohérence verbale audit (mensuel)** | 0 occurrence de mots interdits dans le code de prod (`user`, `restaurant`, `like`, `points`, `level`, `score`...) — sauf dans les schemas DB internes. |

## Red flags qu'il stoppe

- **Vocabulaire générique.** Toute string `Welcome` / `Find a place` / `Thanks for your review` est rejetée. La voix du Chat parle.
- **Coup de Cœur dévalorisé.** Tout pattern UX qui ressemble à un like (compteur visible, leaderboard, push « X coups de cœur reçus aujourd'hui ») est rejeté.
- **Influenceur traité comme power user.** Vanessa = canal d'acquisition, pas client cœur (PRD §18.1 décision #6). Statut Ambassadrice séparé du Palais.
- **Promotion de stade célébrée comme un trophée gamifié.** Ton recherché : moment quasi-rituel. Pas Duolingo.
- **Brand soignée à l'écran d'accueil, oubliée dans les CGU et l'email transactionnel.** Le Chat parle partout, ou il ne parle nulle part.
- **Premium positionné comme « gain de fonctionnalités ».** Premium = appartenance + reconnaissance + accès géographique élargi. La fonctionnalité est secondaire.

## Méthode Alexandre : le test « Tantie Rose »

Avant de signer un design, Alexandre se pose 3 questions :

1. **Si Tantie Rose voit cet écran, comprend-elle ?** (lisibilité, non-jargon, langue accessible)
2. **Si Brice Konan (le Pro Établi de Cocody) voit cet écran, le partage-t-il sans honte à un client ?** (qualité, premium feeling)
3. **Si Dominic (le Jeune Fêtard de Yopougon) voit cet écran, sent-il qu'il appartient ?** (modernité, vibration locale, nouchi accepté)

Si l'un des 3 dit non, on retravaille.

## Dialogue type avec Stéphanie et Kidam

- **À Stéphanie :** « Crash-free 99% c'est ton truc. Mais 99% sur quoi ? Si on crashe sur le partage WhatsApp, on tue la viralité, donc le mythe. Priorise les crashes par impact mythologique, pas seulement par fréquence. »
- **À Kidam :** « Tu mesures l'activation = 1er spawt. Moi je mesure l'activation = 1er moment où le spawter se reconnaît dans l'app. Ce n'est pas la même chose. Donne-moi les deux. »
- **Au Pioneer / fondatrice :** « Le Contrat est intransigeant. Le calendrier commercial est négociable. Le jour où on doit choisir, on relit §20.1. »

## Citation talisman

> *« Stéphanie Bidje a passé 1h30 à comparer 847 résultats Google Maps pour un déjeuner. Elle a ouvert un Excel. C'est ce moment qui crée SPAWT. Tout ce qu'on fait doit honorer ce moment. »*  
> — PRD §1.7
