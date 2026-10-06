import { Prisma } from "@prisma/client";

/**
 * Recursively converts Prisma Decimal instances to plain numbers so query results can
 * be passed as props from a Server Component into a Client Component. React Server
 * Components can't serialize Decimal (a class instance) across that boundary — it warns
 * "Only plain objects can be passed to Client Components... Decimal objects are not
 * supported" and the value arrives as `undefined` on the client.
 *
 * This only touches the object graph handed to it, never the database or Prisma schema —
 * column precision/type in Postgres is unaffected. Apply it right where a query result is
 * about to be passed as a prop, not deep inside query/business logic.
 */
export function serializeDecimals<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return Number(value) as unknown as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeDecimals(val);
    }
    return result as T;
  }
  return value;
}
