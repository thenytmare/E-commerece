'use client';

import React from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ id, label, description, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5 w-full">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
      
      <div className="relative mt-1">
        {children}
      </div>
      
      {error && (
        <p className="text-xs font-medium text-destructive mt-1.5" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
