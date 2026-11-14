import type { Prisma } from '@prisma/client';

/**
 * Shape of a Prisma record once its Decimal columns have been converted to
 * plain numbers. Dates are left alone — React serializes those natively.
 */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

function isDecimal(value: object): boolean {
  // Duck-typed rather than `instanceof`: Prisma re-exports Decimal from
  // several entry points and the identity check isn't reliable across them.
  return typeof (value as { toNumber?: unknown }).toNumber === 'function';
}

/**
 * Recursively convert Prisma `Decimal` values to plain numbers.
 *
 * Server Components may only hand plain data to Client Components — React
 * rejects a Decimal instance as a non-plain object, which surfaces as
 * "Only plain objects can be passed to Client Components". Every price in this
 * schema is a Decimal, so anything crossing that boundary goes through here.
 *
 * Money stays whole-shilling (KES has no minor unit in practice here), so the
 * precision lost by going through `number` is not material.
 */
export function serializeDecimals<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) {
    return value as Serialized<T>;
  }

  if (value instanceof Date) {
    return value as Serialized<T>;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeDecimals(entry)) as Serialized<T>;
  }

  if (typeof value === 'object') {
    if (isDecimal(value)) {
      return Number(value) as Serialized<T>;
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = serializeDecimals(entry);
    }
    return result as Serialized<T>;
  }

  return value as Serialized<T>;
}
