# Le Guet sur Android : textes et recette Play

Le Guet fait partie de l’expérience de découverte SPAWT : il alerte l’utilisateur au moment où il passe à proximité, même si l’app n’est pas à l’écran. Le Guet reste un choix de l’utilisateur. Un passage détecté ne vaut jamais visite. Le spawt manuel ne dépend pas de cette permission.

## Texte à intégrer à la description Play et à la présentation web

**Le Guet : un lieu à découvrir, juste à côté.** Si tu l’actives, SPAWT utilise la localisation même lorsque l’application est fermée pour te prévenir à proximité d’un lieu à découvrir ou enregistré. Le Guet peut aussi te rappeler de laisser un avis après une visite que tu as toi-même validée. Tu peux le désactiver à tout moment dans SPAWT.

## Paragraphe localisation pour la politique de confidentialité

Quand tu utilises SPAWT, la position de ton appareil peut servir à afficher les lieux proches et à vérifier ta position au moment d’un spawt manuel. Si tu actives le Guet et accordes l’autorisation Android correspondante, le téléphone détecte aussi, en arrière-plan quand l’application n’est pas utilisée, l’entrée ou la sortie de zones autour de lieux. SPAWT utilise ces événements pour les alertes de proximité et pour le rappel d’avis lié à une visite que tu as validée. Une détection de zone ne crée pas de visite. Sur Android, tu peux couper le Guet dans Paramètres → Le Guet et retirer l’autorisation de localisation depuis les réglages de ton téléphone. Le spawt manuel reste disponible avec une permission de premier plan au moment où elle est nécessaire.

La politique publique doit reprendre ce fonctionnement et être vérifiée à part (notamment les mentions laissées en attente). Ne pas annoncer que la géolocalisation est exclusivement utilisée pour confirmer un spawt ou que les données ne quittent jamais l’appareil : le fonctionnement du spawt manuel et la vérification des visites côté serveur sont distincts.

## Justification de l’autorisation dans Play Console (anglais)

**Feature: Le Guet, nearby venue discovery.** When a user enables Le Guet, SPAWT uses background location to detect proximity to an eligible venue and show a timely local discovery or saved-venue reminder even when SPAWT is not in use. Foreground-only location provides a map while the app is open, but cannot deliver this time-sensitive alert when the user walks past a venue with the app closed. Location is not used by this feature for advertising. A geofence event never creates a visit. A related review reminder is available only after a user-confirmed visit. Android users opt in after a separate in-app disclosure and may turn Le Guet off without losing manual check-ins.

## Recette à filmer sur Android depuis le nouveau binaire signé

1. Installer le candidat sur un appareil Android disposant de Google Play Services. Utiliser un profil démo non personnel avec Guet actif côté serveur et un lieu éligible. Le trajet de recette doit commencer hors de la zone. Préférer une plage 09 h–22 h locale ; le délai nominal est de deux minutes et les plafonds locaux peuvent bloquer un second essai.
2. Depuis l’accueil, ouvrir **Découvrir et activer le Guet**. Capturer la totalité du communiqué avant la première demande de localisation du Guet. Montrer également l’option **Pas maintenant**, puis l’activation possible depuis Paramètres → Le Guet.
3. Sur la voie d’activation, montrer le choix explicite, les autorisations nécessaires de notification et de localisation puis, lorsque le système le demande, le choix « Toujours autoriser ». Appuyer sur Home et entrer dans la zone ; filmer la notification réelle alors que SPAWT est hors écran, puis ouvrir la fiche. N’employer ni notification simulée ni capture du code du compte démo.
4. Désactiver le Guet, vérifier qu’il ne signale plus l’entrée dans une autre zone, et vérifier que la recette manuelle fonctionne toujours (avec sa permission de premier plan). Refaire sur un profil ayant refusé ou retiré la permission pour vérifier qu’aucun nouveau dialogue n’est relancé sans geste explicite.
5. Déposer uniquement après recette : descriptif révisé, politique publique alignée, déclaration et lien interne/non répertorié vers la vidéo réelle. Aucun de ces textes ne prouve à lui seul l’approbation de Google.

Source : https://support.google.com/googleplay/android-developer/answer/9799150?hl=fr
