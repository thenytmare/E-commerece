/**
 * Delivery options, locations and fees.
 *
 * One source of truth for the checkout form (preview), the order total
 * (OrderRepository.createFromCart) and the pay page (which methods to offer).
 * The server always recomputes the fee from `zone` + `location` here, so a
 * fee sent from the browser is never trusted.
 *
 * Deliberately dependency-free so it is safe to import from a client bundle.
 * To change a price, edit the number next to the location below.
 */

import { FREE_SHIPPING_THRESHOLD_KES } from './constants';

export type DeliveryZone = 'PICKUP' | 'NAIROBI' | 'OUTSIDE_NAIROBI' | 'OUTSIDE_KENYA';

export interface DeliveryLocation {
  name: string;
  /** Fee in KES */
  fee: number;
}

export const DELIVERY_ZONES: readonly { id: DeliveryZone; label: string }[] = [
  { id: 'PICKUP', label: 'Shop Pickup' },
  { id: 'NAIROBI', label: 'Nairobi Delivery' },
  { id: 'OUTSIDE_NAIROBI', label: 'Outside Nairobi' },
  { id: 'OUTSIDE_KENYA', label: 'Outside Kenya' },
];

/** Free collection from the shop. */
export const PICKUP_FEE_KES = 0;

export const PICKUP_INFO = {
  title: 'Shop Pickup Information',
  body: 'Visit our store to collect your order. Free pickup available during business hours.',
  hours: 'Monday - Saturday, 8:00 AM - 8:00 PM',
} as const;

/** Nairobi Delivery: area within Nairobi and its fee. */
export const NAIROBI_LOCATIONS: readonly DeliveryLocation[] = [
  { name: 'Nairobi CBD', fee: 100 },
  { name: 'Upper Hill', fee: 200 },
  { name: 'Ngara', fee: 200 },
  { name: 'Pangani', fee: 200 },
  { name: 'Parklands', fee: 250 },
  { name: 'Westlands', fee: 200 },
  { name: 'Hurlingham', fee: 200 },
  { name: 'Kilimani', fee: 250 },
  { name: 'Kileleshwa', fee: 250 },
  { name: 'Lavington', fee: 250 },
  { name: 'Riverside', fee: 250 },
  { name: 'Spring Valley', fee: 250 },
  { name: 'Madaraka', fee: 250 },
  { name: 'South B', fee: 250 },
  { name: 'South C', fee: 250 },
  { name: 'Nairobi West', fee: 250 },
  { name: 'Woodley', fee: 250 },
  { name: 'Langata', fee: 300 },
  { name: 'Karen', fee: 300 },
  { name: 'Kawangware', fee: 300 },
  { name: 'Kangemi', fee: 300 },
  { name: 'Eastleigh', fee: 300 },
  { name: 'Ruaraka', fee: 300 },
  { name: 'Garden Estate', fee: 300 },
  { name: 'Ridgeways', fee: 300 },
  { name: 'Thome', fee: 300 },
  { name: 'Kasarani', fee: 350 },
  { name: 'Roysambu', fee: 350 },
  { name: 'Zimmerman', fee: 350 },
  { name: 'Umoja', fee: 350 },
  { name: 'Buruburu', fee: 350 },
  { name: 'Donholm', fee: 350 },
  { name: 'Embakasi', fee: 350 },
  { name: 'Imara Daima', fee: 350 },
  { name: 'Nyayo Estate', fee: 350 },
  { name: 'Kayole', fee: 400 },
  { name: 'Komarock', fee: 400 },
  { name: 'Pipeline', fee: 400 },
  { name: 'Utawala Githunguri', fee: 600 },
  { name: 'Mihango', fee: 400 },
  { name: 'Njiru', fee: 400 },
  { name: 'Ruai', fee: 600 },
  { name: 'Mwiki', fee: 400 },
  { name: 'Dandora', fee: 450 },
  { name: 'Kariobangi', fee: 450 },
  { name: 'Korogocho', fee: 450 },
  { name: 'Mathare', fee: 450 },
  { name: 'Githurai', fee: 450 },
  { name: 'Kibera', fee: 450 },
  { name: 'Huruma', fee: 450 },
  { name: 'Nyari Estate', fee: 300 },
  { name: 'Red Hill Road', fee: 300 },
  { name: 'Gachie', fee: 350 },
  { name: 'Two Rivers', fee: 300 },
  { name: 'Syokimau', fee: 450 },
  { name: 'Katani', fee: 450 },
  { name: 'Rongai', fee: 450 },
  { name: 'Uthiru', fee: 350 },
  { name: 'Kinoo', fee: 400 },
  { name: 'Mwihoko', fee: 600 },
  { name: 'Kamakis', fee: 500 },
  { name: 'OJ', fee: 550 },
  { name: 'Tatu City', fee: 700 },
  { name: 'Kiambu Town', fee: 500 },
  { name: 'Naivasha Rd', fee: 350 },
  { name: 'Gataka', fee: 450 },
  { name: 'Ruaka', fee: 400 },
  { name: 'Village Market', fee: 300 },
  { name: 'Kasarani Garage', fee: 400 },
  { name: 'Maji Mazuri', fee: 400 },
  { name: 'Racecourse', fee: 350 },
  { name: 'Brookside Drive', fee: 250 },
  { name: 'Saika', fee: 600 },
  { name: "Mihang'o Utawala", fee: 500 },
  { name: 'Utawala', fee: 450 },
  { name: 'Lucky Summer', fee: 350 },
  { name: 'Membley', fee: 600 },
];

/** Outside Nairobi: county and its fee. */
export const COUNTY_LOCATIONS: readonly DeliveryLocation[] = [
  { name: 'Makueni', fee: 250 },
  { name: 'Kiambu', fee: 250 },
  { name: "Murang'a", fee: 250 },
  { name: 'Nyeri', fee: 250 },
  { name: 'Kirinyaga', fee: 250 },
  { name: 'Nyandarua', fee: 250 },
  { name: 'Laikipia', fee: 250 },
  { name: 'Embu', fee: 250 },
  { name: 'Tharaka-Nithi', fee: 250 },
  { name: 'Meru', fee: 250 },
  { name: 'Mombasa', fee: 350 },
  { name: 'Kwale', fee: 300 },
  { name: 'Kilifi', fee: 300 },
  { name: 'Tana River', fee: 300 },
  { name: 'Lamu', fee: 300 },
  { name: 'Taita-Taveta', fee: 300 },
  { name: 'Bungoma', fee: 300 },
  { name: 'Kakamega', fee: 300 },
  { name: 'Vihiga', fee: 300 },
  { name: 'Busia', fee: 300 },
  { name: 'Siaya', fee: 300 },
  { name: 'Kisumu', fee: 350 },
  { name: 'Homa Bay', fee: 300 },
  { name: 'Migori', fee: 300 },
  { name: 'Kisii', fee: 300 },
  { name: 'Nyamira', fee: 300 },
  { name: 'Kericho', fee: 300 },
  { name: 'Bomet', fee: 300 },
  { name: 'Uasin Gishu', fee: 300 },
  { name: 'Elgeyo-Marakwet', fee: 300 },
  { name: 'Nandi', fee: 300 },
  { name: 'Trans Nzoia', fee: 300 },
  { name: 'West Pokot', fee: 300 },
  { name: 'Baringo', fee: 300 },
  { name: 'Nakuru', fee: 300 },
  { name: 'Narok', fee: 300 },
  { name: 'Garissa', fee: 500 },
  { name: 'Wajir', fee: 500 },
  { name: 'Mandera', fee: 350 },
  { name: 'Marsabit', fee: 350 },
  { name: 'Isiolo', fee: 350 },
  { name: 'Kitui', fee: 400 },
  { name: 'Machakos', fee: 400 },
  { name: 'Kajiado', fee: 400 },
  { name: 'Samburu', fee: 400 },
  { name: 'Turkana', fee: 450 },
];

/** Outside Kenya: country and its fee. */
export const COUNTRY_LOCATIONS: readonly DeliveryLocation[] = [
  { name: 'Uganda', fee: 1000 },
  { name: 'Tanzania', fee: 1000 },
];

export function isDeliveryZone(value: unknown): value is DeliveryZone {
  return DELIVERY_ZONES.some((zone) => zone.id === value);
}

/** The locations a customer picks from for a zone (empty for pickup). */
export function locationsForZone(zone: DeliveryZone): readonly DeliveryLocation[] {
  switch (zone) {
    case 'NAIROBI':
      return NAIROBI_LOCATIONS;
    case 'OUTSIDE_NAIROBI':
      return COUNTY_LOCATIONS;
    case 'OUTSIDE_KENYA':
      return COUNTRY_LOCATIONS;
    case 'PICKUP':
      return [];
  }
}

/**
 * Fee for a zone + location, before any free-delivery threshold.
 * Returns null when the location isn't on the list for that zone.
 */
export function deliveryFeeFor(zone: DeliveryZone, location: string | null | undefined): number | null {
  if (zone === 'PICKUP') return PICKUP_FEE_KES;
  const match = locationsForZone(zone).find((entry) => entry.name === location);
  return match ? match.fee : null;
}

/** Cash on Delivery is offered for Nairobi deliveries only. */
export function isCashOnDeliveryAvailable(zone: string | null | undefined): boolean {
  return zone === 'NAIROBI';
}

export function deliveryZoneLabel(zone: string | null | undefined): string {
  return DELIVERY_ZONES.find((entry) => entry.id === zone)?.label ?? 'Delivery';
}

/**
 * What the customer actually pays for delivery: the location fee, or nothing
 * once the subtotal reaches the store's free-delivery threshold.
 * Returns null for an unknown location so callers can reject it.
 */
export function shippingFor(
  subtotal: number,
  zone: DeliveryZone,
  location: string | null | undefined
): number | null {
  const fee = deliveryFeeFor(zone, location);
  if (fee === null) return null;
  return subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 0 : fee;
}
