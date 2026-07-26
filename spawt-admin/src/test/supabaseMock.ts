// Console admin 07/2026 — fake minimal du query builder supabase-js pour les
// tests de pages (pattern « mock dataProvider ») : chaque appel chaîné
// s'enregistre, la résolution finale est déléguée à un resolver par table/op.
// Utilisé via vi.mock("../../utility/supabaseClient", …).

export type MockOp = "select" | "insert" | "update" | "delete";

export interface MockResult {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number;
}

export interface MockQueryCtx {
  table: string;
  op: MockOp;
  /** Payload d'insert/update (null pour select/delete). */
  payload: unknown;
  /** Arguments des méthodes chaînées (eq, order, select, …). */
  calls: Record<string, unknown[][]>;
}

export type MockResolver = (ctx: MockQueryCtx) => MockResult;

const CHAINED = [
  "select", "order", "limit", "eq", "neq", "is", "in", "gte", "lte", "lt",
  "gt", "not", "single", "maybeSingle",
] as const;

/** Fabrique un `from(table)` thenable compatible avec les pages admin. */
export function createFromMock(resolve: MockResolver) {
  return (table: string) => {
    const ctx: MockQueryCtx = { table, op: "select", payload: null, calls: {} };
    // deno-lint / eslint : builder volontairement any-ish, périmètre test only.
    const builder: Record<string, unknown> = {};
    for (const name of CHAINED) {
      builder[name] = (...args: unknown[]) => {
        (ctx.calls[name] ??= []).push(args);
        return builder;
      };
    }
    builder.insert = (row: unknown) => {
      ctx.op = "insert";
      ctx.payload = row;
      return builder;
    };
    builder.update = (values: unknown) => {
      ctx.op = "update";
      ctx.payload = values;
      return builder;
    };
    builder.delete = () => {
      ctx.op = "delete";
      return builder;
    };
    builder.then = (
      onFulfilled?: (r: MockResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolve(ctx)).then(onFulfilled, onRejected);
    return builder;
  };
}
