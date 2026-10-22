# Continuité des favoris — réception partielle du 7 octobre 2026

Trois critères ont d'abord échoué sur le store réel : conserver deux choix
simultanés, respecter une suppression distante, ignorer la réponse du compte
précédent après déconnexion. Le correctif conserve le cache et les changements
explicitement en attente dans un seul document sous la clé existante
`spawt:saved_places`. Il sérialise les écritures locales sans tenir le verrou
pendant le réseau. Chaque choix porte une révision et le document son compte.

Une lecture distante fait foi sauf pour ces changements non acquittés. Un succès
serveur n'acquitte que la révision envoyée, jamais un choix contraire arrivé
entretemps. Les erreurs Supabase remontent. La reprise utilise le lancement et
les listeners réseau/foreground existants. Les écrans fiche, favoris et Rapide
signalent les refus d'enregistrement local ; une liste illisible reste intacte,
affiche une reprise et ne bloque pas les autres parcours.

La sortie du compte invalide les callbacks de cette session. Elle purge aussi
l'identité, le Palais, les spawts et les consentements persistés, qui pouvaient
restaurer l'ancien compte à la relance. Les écritures tardives de Gold, statut
interne et archétype issues de l'hydratation passent avant la purge ou sont
écartées ; leur résultat ne peut plus restaurer l'état en mémoire après sortie.

## Contrôles

18 scénarios du store réel : concurrence, suppression distante, reprise d'ajout
et de retrait après relance, choix inverse pendant l'envoi, geste pendant réseau
lent, erreurs de lecture/écriture/acquittement, propriétaire de cache, sortie et
relance, hydratation tardive, Gold et statut interne/archétype tardifs.
Trois scénarios de l'adaptateur Supabase contrôlent refus et paire compte/lieu.
Un scénario branche le retour réseau aux deux reprises existantes. Trois scénarios
UI supplémentaires reçoivent l'erreur et distinguent panne de lecture et liste vide.

La suite Jest utilise un adaptateur Babel **uniquement en test** pour que les
imports différés passent par son registre CommonJS et ses mocks. Sans lui,
le test réseau n'exécutait pas le branchement NetInfo ; cet échec de dispositif
n'est pas une panne du binaire. Expo/Metro conserve sa transformation normale.
Les assets locaux sont simulés dans le checkout de sources ; l'export web avec
les assets réels doit être reçu dans la CI du dépôt, sans export de corpus média.

## Réceptions ouvertes

L'ancien tableau local ne distinguait pas cache et ajout hors ligne : il reste
lisible hors ligne mais n'est pas promu en mutations à rejouer. Après lecture
serveur réussie, une entrée ancienne absente du serveur n'est pas recréée.
La déconnexion conserve sa politique de purge locale explicite, y compris les
favoris encore non synchronisés. Ce lot ne promet pas leur récupération après
une purge ni une fusion simultanée entre plusieurs appareils déconnectés.

Deux comptes et deux appareils authentifiés, les autres callbacks du store, la
file des spawts, le cycle d'avis/édition et l'apprentissage du Palais, la livraison
native et la circulation produit vers marque restent à recevoir séparément.
Aucun OTP, consentement, GPS, message, paiement, build EAS ou OTA n'est exécuté
par ces contrôles. La livraison du code et sa réception d'usage sont distinctes.
