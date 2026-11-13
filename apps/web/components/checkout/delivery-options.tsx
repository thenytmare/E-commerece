'use client';

import { formatPrice } from '@/lib/format';
import {
  DELIVERY_ZONES,
  PICKUP_INFO,
  isCashOnDeliveryAvailable,
  locationsForZone,
  type DeliveryZone,
} from '@repo/config/delivery';
import { Text } from '@repo/ui';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DeliveryChoice } from './CheckoutClient';

interface DeliveryOptionsProps {
  value: DeliveryChoice;
  onChange: (value: DeliveryChoice) => void;
  storeAddress: string;
  disabled?: boolean;
  zoneError?: string;
  locationError?: string;
}

const SEARCH_PLACEHOLDER: Record<Exclude<DeliveryZone, 'PICKUP'>, string> = {
  NAIROBI: 'Search and select your area...',
  OUTSIDE_NAIROBI: 'Search and select your county...',
  OUTSIDE_KENYA: 'Search and select your country...',
};

/**
 * Delivery option tiles plus a searchable location list with each fee.
 * Submits `deliveryZone` and `deliveryLocation` as hidden fields.
 */
export function DeliveryOptions({
  value,
  onChange,
  storeAddress,
  disabled,
  zoneError,
  locationError,
}: DeliveryOptionsProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const zone = value.zone;
  const locations = useMemo(() => (zone ? locationsForZone(zone) : []), [zone]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? locations.filter((entry) => entry.name.toLowerCase().includes(term)) : locations;
  }, [locations, query]);

  // Close the list when clicking anywhere else on the page.
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const chooseZone = (next: DeliveryZone) => {
    setQuery('');
    setOpen(false);
    onChange({ zone: next, location: null });
  };

  const chooseLocation = (name: string) => {
    setQuery(name);
    setOpen(false);
    onChange({ zone, location: name });
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="deliveryZone" value={zone ?? ''} />
      <input type="hidden" name="deliveryLocation" value={value.location ?? ''} />

      <fieldset>
        <legend className="sr-only">Delivery option</legend>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {DELIVERY_ZONES.map((option) => {
            const selected = zone === option.id;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 text-center text-sm font-semibold transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="deliveryZoneChoice"
                  value={option.id}
                  checked={selected}
                  onChange={() => chooseZone(option.id)}
                  disabled={disabled}
                  className="accent-primary"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {zoneError ? (
        <p className="text-sm text-destructive" role="alert">
          {zoneError}
        </p>
      ) : null}

      {zone === 'PICKUP' ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="mb-1 font-semibold">{PICKUP_INFO.title}</p>
          <p className="text-muted-foreground">{PICKUP_INFO.body}</p>
          <p className="mt-2 text-muted-foreground">
            <span className="font-medium text-foreground">Location:</span> {storeAddress}
          </p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">Business Hours:</span> {PICKUP_INFO.hours}
          </p>
        </div>
      ) : null}

      {zone && zone !== 'PICKUP' ? (
        <div ref={wrapperRef} className="relative space-y-1">
          <label htmlFor={`${listId}-search`} className="text-sm font-medium">
            Select location *
          </label>
          <input
            id={`${listId}-search`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={SEARCH_PLACEHOLDER[zone]}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              // Typing after a pick clears it until a list item is chosen again.
              if (value.location) onChange({ zone, location: null });
            }}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {open ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-center text-sm text-muted-foreground">
                  No locations found matching &quot;{query}&quot;
                </li>
              ) : (
                filtered.map((entry) => (
                  <li
                    key={entry.name}
                    role="option"
                    aria-selected={value.location === entry.name}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseLocation(entry.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        chooseLocation(entry.name);
                      }
                    }}
                    className="flex cursor-pointer justify-between gap-4 border-b border-border px-4 py-2 text-sm last:border-b-0 hover:bg-primary/5"
                  >
                    <span>{entry.name}</span>
                    <span className="text-muted-foreground">{formatPrice(entry.fee)}</span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          {locationError ? (
            <p className="text-sm text-destructive" role="alert">
              {locationError}
            </p>
          ) : null}
          {isCashOnDeliveryAvailable(zone) ? (
            <Text variant="muted" className="text-xs">
              Cash on Delivery is available for Nairobi deliveries. You can choose it on the next step.
            </Text>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
