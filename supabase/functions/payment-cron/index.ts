// Edge Function `payment-cron` — cycle de vie des abonnements (PRD §11.4).
// Runtime : Deno (Supabase Edge). Appelée 1×/jour par pg_cron + pg_net
// (cf. supabase/seed/payment_cron_setup.sql) ou manuellement (runbook).
//
// Le Mobile Money ne supporte pas le prélèvement automatique (SPEC 4 §4.5) :
// le renouvellement est un cycle de RAPPELS + GRÂCE + DOWNGRADE :
//   1. active, échéance J-3  → push « Ton Gold expire dans 3 jours »
//   2. active, échéance J    → push « C'est aujourd'hui »
//   3. active, échéance passée → status 'grace', grace_until = échéance + 7 j
//      (+ push d'entrée en grâce)
//   4. grace, grace_until passé → status 'expired' (retour spawter gratuit ;
//      les données premium restent en base, cf. SPEC 4 §4.5 étape 4)
//
// COUVERTURE B2B (plans pro / b2b_gold, customer_type 'b2b') : le cron
// travaille par status/expires_at, AGNOSTIQUE au plan — les subscriptions B2B
// suivent donc le MÊME cycle grâce/expiration. Deux différences assumées :
//   - Rappels : copy dédiée (« l'abonnement de ton lieu ») et BEST-EFFORT
//     encore plus qu'en B2C — un compte B2B (auth dédiée, login portail) n'a
//     en général AUCUN push token enregistré (les tokens sont posés par
//     l'app mobile), et ni SMS ni email ne sont câblés ici. L'échec du push
//     est silencieux par design ; le filet de sécurité est le dashboard
//     portail /pro/dashboard qui affiche l'échéance puis « abonnement
//     expiré ».
//   - Expiration : le passage 'expired' NE touche PAS b2b_accounts.role —
//     la coupure d'accès B2B est un ACTE HUMAIN (décision produit, cf.
//     payment-webhook). Le rôle reste, le dashboard signale l'expiration.
//
// Auth : header `x-cron-key` == env CRON_SECRET (409 sinon — contrat chantier).
// Push : POST ${SUPABASE_URL}/functions/v1/push-send (chantier parallèle) —
// best-effort try/catch : un échec de push ne bloque JAMAIS les transitions.
//
// Secrets : CRON_SECRET + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injectés).

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { decideLifecycle } from "../_shared/payment/subscription-lifecycle.ts";
import { isB2bPlan } from "../_shared/payment/types.ts";
import { safeEqual } from "../_shared/safe-equal.ts";

// @ts-expect-error — Deno global
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response> | Response) => void;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logCron(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt: "payment_cron", ...fields }));
}

interface SubRow {
  id: string;
  customer_id: string;
  plan: string;
  status: string;
  expires_at: string | null;
  grace_until: string | null;
}

/** Textes des pushes — serveur (hors périmètre i18n app, français direct). */
const PUSH_COPY = {
  remind_j3: {
    title: "Ton Gold expire dans 3 jours",
    body: "Renouvelle sur spawt.online pour garder tout Abidjan.",
  },
  remind_j0: {
    title: "Ton Gold expire aujourd'hui",
    body: "C'est le jour J — renouvelle sur spawt.online.",
  },
  to_grace: {
    title: "Ton Gold est en pause",
    body: "Il te reste 7 jours pour renouveler sans rien perdre.",
  },
} as const;

/**
 * Copy B2B (plans pro / b2b_gold) — envoyée au MÊME canal push-send,
 * best-effort assumé : un compte B2B n'a en général pas de push token
 * (auth dédiée portail, tokens posés par l'app mobile uniquement) et ni SMS
 * ni email n'existent dans ce runtime → l'appel devient no-op côté push-send.
 * Le rappel qui fait foi est l'état affiché sur /pro/dashboard.
 */
const PUSH_COPY_B2B = {
  remind_j3: {
    title: "L'abonnement de ton lieu expire dans 3 jours",
    body: "Renouvelle sur spawt.online/pro pour garder ton tableau de bord.",
  },
  remind_j0: {
    title: "L'abonnement de ton lieu expire aujourd'hui",
    body: "C'est le jour J — renouvelle sur spawt.online/pro.",
  },
  to_grace: {
    title: "L'abonnement de ton lieu est en pause",
    body: "Il te reste 7 jours pour renouveler sans coupure de tableau de bord.",
  },
} as const;

/**
 * Appel best-effort de l'Edge push-send (contrat du chantier push parallèle) :
 * POST /functions/v1/push-send, headers service-role, body
 * {spawter_ids, title, body, data:{type:'gold_renewal', deep_link}}.
 * Toute erreur est avalée + loggée — le push est un confort, pas une garantie.
 */
async function sendPushBestEffort(
  supabaseUrl: string,
  serviceRole: string,
  spawterIds: string[],
  copy: { title: string; body: string },
  // B2C : renouvellement Gold → /gold. B2B : renouvellement lieu → /pro.
  meta: { type: string; deepLink: string } = {
    type: "gold_renewal",
    deepLink: "https://spawt.online/gold",
  },
): Promise<boolean> {
  if (spawterIds.length === 0) return true;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/push-send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
      },
      body: JSON.stringify({
        spawter_ids: spawterIds,
        title: copy.title,
        body: copy.body,
        data: { type: meta.type, deep_link: meta.deepLink },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      logCron({ step: "push_send_failed", http: resp.status, count: spawterIds.length });
      return false;
    }
    return true;
  } catch (err) {
    logCron({
      step: "push_send_error",
      detail: err instanceof Error ? err.message : String(err),
      count: spawterIds.length,
    });
    return false;
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    });
  }

  // Garde cron : clé partagée en header. Fail-closed si CRON_SECRET absent.
  // Sécurité D5 — comparaison à temps constant (safeEqual) contre le timing.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedKey = req.headers.get("x-cron-key");
  if (!cronSecret || !providedKey || !safeEqual(providedKey, cronSecret)) {
    return json({ error: "unauthorized" }, 409);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ error: "edge_misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  // Toutes les subscriptions vivantes du cycle (active + grace).
  const { data: subs, error: subsErr } = await admin
    .from("subscriptions")
    .select("id, customer_id, plan, status, expires_at, grace_until")
    .in("status", ["active", "grace"]);
  if (subsErr) {
    logCron({ step: "db_error_list", detail: subsErr.message });
    return json({ error: "db_error" }, 500);
  }

  const now = new Date();
  const remindJ3: SubRow[] = [];
  const remindJ0: SubRow[] = [];
  const toGrace: Array<{ sub: SubRow; grace_until: string }> = [];
  const toExpired: SubRow[] = [];

  for (const raw of (subs ?? []) as SubRow[]) {
    const action = decideLifecycle({
      status: raw.status,
      expires_at: raw.expires_at,
      grace_until: raw.grace_until,
      now,
    });
    if (action.kind === "remind_j3") remindJ3.push(raw);
    else if (action.kind === "remind_j0") remindJ0.push(raw);
    else if (action.kind === "to_grace") toGrace.push({ sub: raw, grace_until: action.grace_until });
    else if (action.kind === "to_expired") toExpired.push(raw);
  }

  // ── Transitions d'état (avant les pushes : l'état prime sur le confort) ───
  let movedToGrace = 0;
  for (const { sub, grace_until } of toGrace) {
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "grace", grace_until })
      .eq("id", sub.id)
      .eq("status", "active"); // garde : ne transitionne que depuis active
    if (error) {
      logCron({ step: "db_error_to_grace", subscription_id: sub.id, detail: error.message });
    } else {
      movedToGrace += 1;
      logCron({ step: "to_grace", subscription_id: sub.id, grace_until });
    }
  }

  let expired = 0;
  // NB B2B : passer une subscription pro/b2b_gold en 'expired' ne rétrograde
  // PAS b2b_accounts.role — la coupure d'accès est un acte humain (décision
  // produit, cf. payment-webhook). Le portail affiche « abonnement expiré ».
  for (const sub of toExpired) {
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id)
      .eq("status", "grace");
    if (error) {
      logCron({ step: "db_error_to_expired", subscription_id: sub.id, detail: error.message });
    } else {
      expired += 1;
      logCron({ step: "to_expired", subscription_id: sub.id });
    }
  }

  // ── Résolution customer_id → spawter_id pour les pushes ───────────────────
  const customerIds = [
    ...new Set(
      [...remindJ3, ...remindJ0, ...toGrace.map((t) => t.sub)].map((s) => s.customer_id),
    ),
  ];
  const spawterByCustomer = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers, error: custErr } = await admin
      .from("customers")
      .select("id, spawter_id")
      .in("id", customerIds);
    if (custErr) {
      logCron({ step: "db_error_customers", detail: custErr.message });
    } else {
      for (const c of (customers ?? []) as Array<{ id: string; spawter_id: string }>) {
        spawterByCustomer.set(c.id, c.spawter_id);
      }
    }
  }
  const spawterIdsOf = (rows: SubRow[]): string[] => [
    ...new Set(
      rows
        .map((s) => spawterByCustomer.get(s.customer_id))
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  // ── Pushes best-effort (chantier push-send parallèle) ─────────────────────
  // Split B2C / B2B : copy et deep link dédiés. Côté B2B c'est doublement
  // best-effort (pas de push token en général, pas de SMS/email ici) — le
  // dashboard portail reste le canal fiable, cf. header.
  const splitByFamily = (rows: SubRow[]): { b2c: SubRow[]; b2b: SubRow[] } => {
    const b2c: SubRow[] = [];
    const b2b: SubRow[] = [];
    for (const row of rows) (isB2bPlan(row.plan) ? b2b : b2c).push(row);
    return { b2c, b2b };
  };
  const B2B_META = { type: "b2b_renewal", deepLink: "https://spawt.online/pro/dashboard" };

  const j3 = splitByFamily(remindJ3);
  const j0 = splitByFamily(remindJ0);
  const grace = splitByFamily(toGrace.map((t) => t.sub));

  await sendPushBestEffort(supabaseUrl, serviceRole, spawterIdsOf(j3.b2c), PUSH_COPY.remind_j3);
  await sendPushBestEffort(supabaseUrl, serviceRole, spawterIdsOf(j0.b2c), PUSH_COPY.remind_j0);
  await sendPushBestEffort(supabaseUrl, serviceRole, spawterIdsOf(grace.b2c), PUSH_COPY.to_grace);

  await sendPushBestEffort(
    supabaseUrl,
    serviceRole,
    spawterIdsOf(j3.b2b),
    PUSH_COPY_B2B.remind_j3,
    B2B_META,
  );
  await sendPushBestEffort(
    supabaseUrl,
    serviceRole,
    spawterIdsOf(j0.b2b),
    PUSH_COPY_B2B.remind_j0,
    B2B_META,
  );
  await sendPushBestEffort(
    supabaseUrl,
    serviceRole,
    spawterIdsOf(grace.b2b),
    PUSH_COPY_B2B.to_grace,
    B2B_META,
  );

  const summary = {
    scanned: (subs ?? []).length,
    reminded_j3: remindJ3.length,
    reminded_j0: remindJ0.length,
    moved_to_grace: movedToGrace,
    expired,
  };
  logCron({ step: "done", ...summary });
  return json({ success: true, ...summary });
}

Deno.serve(handleRequest);
