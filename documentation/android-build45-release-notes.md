# SPAWT Android 1.1.4 · Alpha 45

Cette alpha ajoute la reprise d’une campagne par lien ou code, la proposition d’ouvrir la fiche IN’ Concept Store et l’accès direct au témoignage Le Cha. La carte d’Abidjan regroupe ses repères et revient à la liste lorsque le téléphone ne peut pas afficher le fond cartographique.

L’APK signé pèse **162 850 779 octets**. Son SHA-256 est `b6a092e3935835de1f6a0b6384c953d96b0f37ed15eaeb5ba842527a95e63a90`. Son certificat est identique à celui de l’alpha 42. [Compilation signée](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/45709291720)

## Reçus disponibles à la publication

- L’installation du 45 par-dessus le 42 a conservé la date de première installation sur Android 15. La mise à jour depuis le 44, l’ouverture à froid, le redémarrage du processus et l’initialisation de Firebase ont également été vérifiés. [Recette de l’APK signé](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/45717595799)
- Depuis Chrome 124 sur Android 15 émulé, le lien HTTPS a ouvert à froid l’avis Le Cha. Le texte, les trois notes et la photo ont été lus. Sur le client de recette issu des mêmes sources, le catalogue de 155 lieux et 111 points a supporté le passage carte/liste puis le retour à la carte sans crash observé. [Essai Android du pilote](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/45710839404)
- Sur le binaire signé relié au service de production, l’émulateur a lu le menu et retrouvé les Eggs Benedict. L’enregistrement du plat hors connexion a reçu l’acquittement du serveur après redémarrage. Le test suivant s’est arrêté sur un nom de liste saisi incomplet. [Essai en production](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/45714341674)

## Réserves de l’alpha

L’équipe a autorisé la publication avec les réceptions encore ouvertes. Les échanges avec le support et la modération complète en production restent à recevoir. L’équipe atteste avoir validé le Guet sur mobile. Aucun nouveau reçu terrain spécifique au build 45 n’a été produit.

Le premier essai HTTPS à chaud est resté dans Chrome. Les deux parcours complets d’attribution et la conservation d’un favori de lieu acquis sous 42 restent à vérifier. Le reçu structuré de cette publication est joint sous `release-qualification.json`.

### Restauration d’un compte ancien

Lors de la recette isolée, un compte déjà créé avec un Palais et une date d’acceptation des CGV absente sur le serveur a pu se connecter. Le 45 a ensuite remplacé l’acceptation qui venait d’être donnée sur ce téléphone par la valeur vide du profil. Le suivi de première ouverture et le rattachement à la campagne attendent alors un consentement. Une fois connecté, l’alpha 45 ne propose aucun écran permettant de le redonner.

Sur un ancien compte dont le consentement avait bien été enregistré, le second essai a reçu côté serveur la première ouverture et le rattachement Facebook à la bonne installation. Cette observation concerne l’émulation Android et un compte de recette. [Nouvel essai du pilote](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/45724053402)
