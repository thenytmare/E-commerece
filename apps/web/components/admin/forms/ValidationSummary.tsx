'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ValidationSummaryProps {
  errors: string[];
}

export function ValidationSummary({ errors }: ValidationSummaryProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-destructive">Please fix the following errors:</h4>
          <ul className="mt-2 text-sm text-destructive list-disc list-inside space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
