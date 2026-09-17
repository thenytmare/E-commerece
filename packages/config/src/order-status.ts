/**
 * Order status transition rules.
 *
 * These live in the shared config package so the repository that enforces them
 * and the admin UI that draws buttons from them can't drift apart. The admin
 * form used to carry its own private copy, which meant hiding a button was the
 * only thing standing between an admin and an invalid transition.
 *
 * Deliberately dependency-free so it is safe to import from a client bundle.
 */
export type OrderStatusName =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusName, OrderStatusName[]> = {
  PENDING: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Statuses where the goods are still with us, so reserved stock may be
 * released. Releasing it after dispatch would put units back on sale that have
 * already physically left the warehouse.
 */
export const PRE_FULFILMENT_ORDER_STATUSES: readonly OrderStatusName[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
];

export function canTransitionOrderStatus(from: OrderStatusName, to: OrderStatusName): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses this order may legally move to right now. */
export function allowedNextStatuses(from: OrderStatusName): OrderStatusName[] {
  return [...(ORDER_STATUS_TRANSITIONS[from] ?? [])];
}
