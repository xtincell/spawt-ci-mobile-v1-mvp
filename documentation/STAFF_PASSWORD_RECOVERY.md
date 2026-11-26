# Récupération du mot de passe du panel SPAWT (Coolify)

Conserver la connexion staff actuelle et le service GoTrue auto-hébergé. Aucun compte
Coolify et aucune connexion à Supabase Cloud. Ne pas couper le login existant.
Le bouton est invisible et les routes restent désactivées tant que
VITE_STAFF_RECOVERY_ENABLED n'est pas fixé à true au build du panel.

Prérequis: SMTP transactionnel approuvé (relais et expéditeur vérifié), secrets
dans le seul service Auth, jamais dans le bundle. Autoriser exactement
https://admin.spawt.online/reinitialiser dans GOTRUE_URI_ALLOW_LIST sans effacer les
entrées existantes. Configurer le modèle de récupération propre à l’admin avec :
```html
{{ if eq .RedirectTo "https://admin.spawt.online/reinitialiser" }}
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Réinitialiser mon mot de passe SPAWT</a></p>
{{ else }}
<p><a href="{{ .ConfirmationURL }}">Réinitialiser mon mot de passe</a></p>
{{ end }}
```
Le fragment n'est pas envoyé au serveur web; aucune validation OTP automatique au
chargement, ce qui évite la consommation par un simple préchargement de lien.
La session de récupération est transitoire et le droit staff actif est vérifié
avant tout changement. Ne pas ajouter de règle de redirection générique.

Valider en préproduction puis, en prod, avec un compte staff de recette et une
boîte autorisée: e-mail reçu, lien à usage unique, lien expiré/refus, refus du
changement via le panel pour un compte non staff, reconnexion avec le nouveau
mot de passe. Ne pas envoyer de test aux comptes d’équipe réels sans autorisation.
