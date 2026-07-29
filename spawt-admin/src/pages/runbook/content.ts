// Console admin — le mode d'emploi de la suite SPAWT, pour les développeurs.
//
// Pourquoi ce contenu vit ici et pas seulement dans un README : un runbook
// qu'il faut cloner un dépôt pour lire n'est pas lu. Celui-ci s'ouvre depuis la
// console, derrière l'authentification staff, à côté des écrans qu'il décrit.
//
// Règle d'écriture : chaque section dit CE QU'ON FAIT, POURQUOI c'est comme ça,
// et le PIÈGE qui a déjà coûté une journée. Une procédure sans son piège est
// une procédure qu'on refait à l'aveugle.
//
// ⚠️ Aucun secret ici. Pas de clé, pas de mot de passe, pas de jeton. Cette
// page est servie à tout compte staff, y compris `operator`. Les secrets vivent
// dans Coolify et dans le gestionnaire de mots de passe de l'équipe.

export interface RunbookBloc {
  /** `p` = paragraphe, `code` = bloc de commandes, `liste` = puces, `alerte` = piège. */
  type: "p" | "code" | "liste" | "alerte";
  texte?: string;
  lignes?: string[];
}

export interface RunbookSection {
  id: string;
  titre: string;
  resume: string;
  blocs: RunbookBloc[];
}

export const RUNBOOK: RunbookSection[] = [
  {
    id: "carte",
    titre: "La carte des lieux (au sens infrastructure)",
    resume: "Quatre dépôts, cinq URL, une seule base.",
    blocs: [
      {
        type: "liste",
        lignes: [
          "app/ — l'app mobile Expo. C'est le produit.",
          "spawt-admin/ — cette console. Refine + Vite, build statique servi par nginx.",
          "supabase/ — les migrations SQL et les Edge Functions Deno. Le backend.",
          "project_spawt_mobile_ci — le portail web (vitrine, Gold, Pro, ambassadeurs).",
          "spawt-meute-quiz — le quiz d'archétype La Meute.",
        ],
      },
      {
        type: "liste",
        lignes: [
          "api.spawt.online — le backend (Kong du stack Supabase self-hosted).",
          "admin.spawt.online — cette console.",
          "portail.spawt.online — le portail, derrière le rideau d'avant-lancement.",
          "quiz.spawt.online — le quiz.",
          "spawt.online — la page « Bientôt » publique.",
        ],
      },
      {
        type: "alerte",
        texte:
          "Le projet Supabase hébergé chez supabase.com est SUPPRIMÉ. Toute doc qui le " +
          "mentionne comme actif est périmée. « La base », c'est le PostgreSQL qui tourne " +
          "dans Coolify sur le VPS. Une seule base pour tout, quiz compris.",
      },
    ],
  },
  {
    id: "migrations",
    titre: "Faire évoluer le schéma",
    resume: "Une migration numérotée, son .down.sql, ses tests. Puis le migrateur HTTP.",
    blocs: [
      {
        type: "p",
        texte:
          "Chaque changement de schéma est un fichier NNNN_description.sql dans " +
          "supabase/migrations/, accompagné d'un NNNN_description.down.sql qui sait le " +
          "défaire, et de tests dans supabase/tests/ dès qu'il y a de la logique.",
      },
      {
        type: "code",
        lignes: [
          "cd supabase",
          "export SUPABASE_URL=https://api.spawt.online",
          "export SERVICE_ROLE_KEY=…            # Coolify → service spawt-supabase",
          "",
          "node migrator/migrate-http.mjs --status    # ce qui est appliqué",
          "node migrator/migrate-http.mjs --dry-run   # ce qui partirait",
          "node migrator/migrate-http.mjs             # appliquer",
        ],
      },
      {
        type: "p",
        texte:
          "Le migrateur passe par /pg/query (postgres-meta derrière Kong) : pas besoin " +
          "d'accès SSH, et c'est heureux — le conteneur PostgreSQL ne publie aucun port. " +
          "Chaque migration part en une seule requête, donc dans une transaction " +
          "implicite : une erreur au milieu annule aussi l'enregistrement de la version.",
      },
      {
        type: "alerte",
        texte:
          "--baseline ne sert QU'UNE FOIS, sur une base dont le schéma a été posé à la " +
          "main avant que le migrateur existe. Il marque des migrations comme appliquées " +
          "SANS exécuter leur SQL. Lancé par erreur, il fait sauter des migrations en " +
          "silence.",
      },
    ],
  },
  {
    id: "edge",
    titre: "Déployer les Edge Functions",
    resume: "Un script, et un contrôle en une ligne pour savoir si ça a marché.",
    blocs: [
      {
        type: "code",
        lignes: [
          "export SUPABASE_URL=https://api.spawt.online",
          "export COOLIFY_TOKEN=…   export COOLIFY_URL=…",
          "node scripts/deploy-edge-functions.mjs",
        ],
      },
      {
        type: "p",
        texte:
          "Contrôle : chaque route doit répondre 405 sur un GET (la fonction existe, elle " +
          "refuse juste la méthode). Un 500 InvalidWorkerCreation veut dire que le " +
          "fichier n'est pas là où le runtime le cherche.",
      },
      {
        type: "alerte",
        texte:
          "Piège Coolify vérifié : pour un « file storage » créé par l'API, le fs_path " +
          "qu'on fournit est IGNORÉ — il est déduit du mount_path, et aucun bind-mount " +
          "n'est ajouté au compose. D'où le préfixe /volumes/functions dans le script. " +
          "Le changer casse le déploiement sans message clair.",
      },
    ],
  },
  {
    id: "clients",
    titre: "Redéployer les trois interfaces",
    resume: "Toutes dans Coolify. Une variable Vite qui change impose un REBUILD.",
    blocs: [
      {
        type: "liste",
        lignes: [
          "spawt-admin — cette console (branche de travail).",
          "spawt-portail-apercu — le portail sur portail.spawt.online.",
          "spawt-bientot — la page « Bientôt ».",
          "spawt-quiz — le quiz.",
        ],
      },
      {
        type: "alerte",
        texte:
          "Les variables VITE_* sont figées AU BUILD : Vite les remplace dans le bundle. " +
          "Changer une variable puis « redéployer » ne change rien — il faut rebuilder. " +
          "C'est ce qui a laissé cette console pointer des semaines vers un backend " +
          "supprimé.",
      },
      {
        type: "alerte",
        texte:
          "Construire le portail ou la console SANS les variables produit un bundle " +
          "creux : Rollup élague tout l'arbre de routes et il ne reste que l'écran " +
          "d'erreur de configuration. Un bundle admin sain pèse ~1,5 Mo ; à 400 Ko, il " +
          "est vide.",
      },
    ],
  },
  {
    id: "paiements",
    titre: "Encaisser sans passerelle",
    resume: "Le payeur déclare, l'équipe valide. CinetPay n'est qu'un moyen parmi d'autres.",
    blocs: [
      {
        type: "p",
        texte:
          "Le payeur envoie son versement (Wave, Orange Money, MoMo, Moov, espèces, " +
          "virement) puis le déclare depuis le portail. La demande apparaît dans " +
          "Paiements. Valider ouvre l'abonnement, émet la facture numérotée et " +
          "journalise — en une seule transaction serveur.",
      },
      {
        type: "liste",
        lignes: [
          "Le montant déclaré ne sert JAMAIS à facturer : le prix vient du catalogue plans.",
          "Un double-clic sur « Valider » ne crée pas deux abonnements (provider_tx_id unique).",
          "Un refus exige un motif — le support en a besoin quand le payeur rappelle.",
          "Trois demandes en attente maximum par compte, pour que la file reste lisible.",
        ],
      },
      {
        type: "alerte",
        texte:
          "Avant d'ouvrir le paiement au public : renseigner les coordonnées de versement " +
          "dans la table payment_instructions et les passer is_active = true. Un moyen de " +
          "paiement affiché sans numéro valide génère du support et rien d'autre.",
      },
      {
        type: "alerte",
        texte:
          "Le tarif existe à deux endroits : la table plans (validation manuelle) et " +
          "_shared/payment/types.ts (checkout CinetPay). Ils DOIVENT concorder — sinon le " +
          "même abonnement est facturé à deux prix selon le canal. Ils ont divergé une " +
          "fois de 3 000 F sur l'annuel.",
      },
    ],
  },
  {
    id: "flags",
    titre: "Allumer et éteindre des fonctionnalités",
    resume: "Page Fonctionnalités, quatre portées. Aucun redéploiement.",
    blocs: [
      {
        type: "p",
        texte:
          "Chaque fonctionnalité a un interrupteur par portée : internal, alpha, beta, " +
          "prod. La règle de résolution est : réglage propre au compte, sinon réglage " +
          "global de la portée, sinon éteint. L'app relit à chaque hydratation.",
      },
      {
        type: "alerte",
        texte:
          "paywall-geo (le rayon gratuit de 3 km) reste éteint sur prod tant que les " +
          "coordonnées de versement ne sont pas renseignées. Un paywall sans moyen de " +
          "payer, c'est de la frustration pure — l'étude de marché le signalait déjà.",
      },
    ],
  },
  {
    id: "interne",
    titre: "Comptes internes et aperçus",
    resume: "Voir l'app comme un gratuit puis comme un Gold, voir le portail avant tout le monde.",
    blocs: [
      {
        type: "p",
        texte:
          "Un compte interne débloque la section « Mode interne » dans les réglages de " +
          "l'app : bascule entre l'expérience gratuite et l'expérience Gold, aperçu local " +
          "du paywall géographique. Ça ne donne accès à aucune donnée d'autrui et ne " +
          "touche à aucun droit facturé.",
      },
      {
        type: "code",
        lignes: [
          "# avant même la première connexion de la personne",
          "node scripts/grant-internal.mjs --add +2250700000000 --note \"Prénom\"",
          "node scripts/grant-internal.mjs --list",
          "",
          "# après : bouton « Accorder le mode interne » sur sa fiche, page Comptes",
        ],
      },
      {
        type: "p",
        texte:
          "Le portail, lui, est derrière un rideau : les visiteurs voient « Bientôt », un " +
          "membre de l'équipe connecté voit le vrai site. Au lancement, retirer la " +
          "variable VITE_PREVIEW_GATE et rebuilder — rien d'autre à défaire.",
      },
    ],
  },
  {
    id: "app",
    titre: "Construire l'app mobile",
    resume: "Quadruple gate, puis un tag Git. La CI fait le reste.",
    blocs: [
      {
        type: "code",
        lignes: [
          "cd app",
          "npm run typecheck && npm run lint:vocab && npm run i18n:check && npm test",
          "node ../scripts/conformity-check.mjs",
          "",
          "git tag build-android-1 && git push origin build-android-1   # APK de test",
          "git tag build-android-prod-1 && git push origin …            # .aab pour le store",
        ],
      },
      {
        type: "alerte",
        texte:
          "Le mode démo est un choix explicite, plus un repli. Sans backend configuré ET " +
          "sans EXPO_PUBLIC_DEMO_MODE=true, l'app affiche « Configuration manquante » au " +
          "lieu de servir de fausses données. Le repli silencieux d'avant a fait passer " +
          "tous les APK livrés pour un produit vide alors que seule la config de build " +
          "manquait. Un garde-fou CI (check-eas-env) refuse désormais un build " +
          "distribuable sans backend.",
      },
    ],
  },
  {
    id: "pieges",
    titre: "Les pièges qui ont déjà coûté cher",
    resume: "À relire avant de toucher à la RLS ou aux compteurs.",
    blocs: [
      {
        type: "alerte",
        texte:
          "Ne JAMAIS révoquer EXECUTE d'un prédicat de policy RLS au rôle authenticated. " +
          "Une expression de policy est évaluée avec les privilèges de l'APPELANT : la " +
          "révoquer rend 41 policies sur 18 tables inévaluables pour tout compte " +
          "connecté. Plus de push, de badges, de pattes, d'abonnements, de Crew. Aucun " +
          "test unitaire ne peut l'attraper — ils tournent hors base ou en service_role, " +
          "qui contourne la RLS.",
      },
      {
        type: "alerte",
        texte:
          "Pour lire spawt_staff côté client, passer par la fonction current_staff(). Un " +
          "select direct renvoie TOUTE l'équipe à un admin (c'est sa policy), donc un " +
          "maybeSingle() échoue exactement sur le cas nominal.",
      },
      {
        type: "alerte",
        texte:
          "Ne jamais écrire un compteur d'avis à la main. place_adn.total_reviews est " +
          "recalculé depuis les lignes réelles. Les avis fondateurs alimentent la note, " +
          "la confiance et les axes, mais jamais le compteur public.",
      },
      {
        type: "alerte",
        texte:
          "Les coordonnées GPS des lieux importés sont au niveau du quartier (±200-400 m). " +
          "C'est suffisant pour le feed, insuffisant pour le géofence de 100 m du Guet. " +
          "Relever les points sur place avant d'activer le Guet en production.",
      },
    ],
  },
  {
    id: "reste",
    titre: "Ce qui dépend d'un humain",
    resume: "Ni le code ni l'infrastructure ne peuvent le faire.",
    blocs: [
      {
        type: "liste",
        lignes: [
          "Termii — crédits SMS. Sans clé, l'OTP échoue en fermé (pas de code universel).",
          "Coordonnées de versement — numéros Wave / Orange / MoMo à renseigner.",
          "Apple Developer (99 $/an) et Google Play Console (25 $) pour publier.",
          "Firebase — google-services.json pour les notifications Android.",
          "Juriste — valider CGU, CGV et confidentialité (loi 2013-450, ARTCI).",
          "GPS des lieux — relever les points sur le terrain avant d'activer Le Guet.",
        ],
      },
    ],
  },
];
