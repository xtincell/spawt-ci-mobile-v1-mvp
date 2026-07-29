# Configuration nginx de la console

`nginx.conf` est la **source de vérité** de ce que sert `admin.spawt.online`.

⚠️ Elle ne fait pas partie du build. La console est déployée en **nixpacks**
(`static_image: nginx:alpine`), et Coolify garde la configuration dans le champ
`custom_nginx_configuration` de l'application — pas dans le dépôt. Ce fichier
existe pour que la conf soit relue, versionnée et revue comme du code ; il faut
la **repousser explicitement** après toute modification :

```bash
node -e 'const fs=require("fs");fs.writeFileSync("/tmp/p.json",JSON.stringify({
  custom_nginx_configuration: fs.readFileSync("spawt-admin/nginx.conf","utf8").toString("base64")}))'
curl -X PATCH "$COOLIFY_URL/api/v1/applications/culwmw8rbc5zcs2t0wf3vwpm" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json" \
  --data-binary @/tmp/p.json
curl -X POST "$COOLIFY_URL/api/v1/deploy?uuid=culwmw8rbc5zcs2t0wf3vwpm&force=true" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
```

Le champ doit être **encodé en base64** — l'API répond 422 sinon.

## Pourquoi les en-têtes de cache comptent ici

La conf d'origine ne posait **aucun** `Cache-Control`. nginx laissait donc le
navigateur appliquer son cache *heuristique* : il considère une page fraîche
pendant une fraction du temps écoulé depuis `Last-Modified`, de son propre chef.

Le mode d'échec qui en découle est déroutant à diagnostiquer. Après un rebuild,
les empreintes des assets changent (`index-DqmTqdi7.js`). Un navigateur qui
garde un `index.html` périmé pointe vers des fichiers qui n'existent plus. Si
son ancien JS est encore en cache mais que l'ancienne CSS a été évincée, on
obtient : **le formulaire s'affiche et fonctionne, mais sans aucune mise en
forme** — titre et sous-titre superposés, carte hors de son centrage. Le serveur
est sain, tous les autres postes vont bien, et un rechargement simple ne suffit
pas toujours puisque le cache est considéré frais.

D'où la règle, désormais posée :

- `/assets/*` — nom porteur d'empreinte, contenu immuable → cache un an,
  `immutable` pour éviter jusqu'à la revalidation.
- `index.html` et toute route SPA → `no-cache, must-revalidate` : la page qui
  désigne les assets ne doit jamais être servie depuis le cache.

`listen [::]:80` est également nécessaire : sur Alpine, `localhost` résout ::1
en premier, et un healthcheck en IPv4 seul renvoie un faux négatif.
