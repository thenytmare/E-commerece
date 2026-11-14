'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { MediaPicker } from './MediaPicker';

interface ImageUrlFieldProps {
  /** Controlled value. Omit `onChange` to use it as an uncontrolled form field. */
  value?: string;
  onChange?: (url: string) => void;
  /** Rendered as a hidden input so plain <form> submissions still pick it up. */
  name?: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Text input for an image URL paired with the Media Library picker and a
 * thumbnail preview. Used anywhere an admin needs to choose an image
 * (categories, banners, homepage hero) so those surfaces aren't stuck with
 * raw URL typing.
 */
export function ImageUrlField({
  value,
  onChange,
  name,
  id,
  defaultValue,
  placeholder = 'https://example.com/image.jpg or pick from library',
  disabled,
}: ImageUrlFieldProps) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value! : internal;

  const [pickerOpen, setPickerOpen] = useState(false);

  const setValue = (url: string) => {
    if (isControlled) onChange!(url);
    else setInternal(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          id={id}
          // When controlled by a parent we still emit the hidden input below,
          // so avoid a duplicate field name here.
          name={isControlled ? undefined : name}
          value={current}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors whitespace-nowrap disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" />
          Browse
        </button>
      </div>

      {isControlled && name ? <input type="hidden" name={name} value={current} /> : null}

      {current ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt="Selected"
            className="h-20 w-20 rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => setValue('')}
            disabled={disabled}
            className="absolute -right-2 -top-2 rounded-full bg-background border border-border p-1 text-muted-foreground hover:text-destructive"
            aria-label="Clear image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => {
          setValue(url);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
