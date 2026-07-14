'use client';

import React from 'react';

export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'draft' | 'archived' | 'published' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border";
  
  let colorClasses = "";
  let defaultLabel = "";

  switch (status) {
    case 'success':
    case 'published':
      colorClasses = "bg-success/10 text-success border-success/20";
      defaultLabel = status === 'success' ? 'Success' : 'Published';
      break;
    case 'warning':
    case 'pending':
      colorClasses = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      defaultLabel = status === 'warning' ? 'Warning' : 'Pending';
      break;
    case 'danger':
      colorClasses = "bg-destructive/10 text-destructive border-destructive/20";
      defaultLabel = 'Danger';
      break;
    case 'info':
      colorClasses = "bg-blue-500/10 text-blue-600 border-blue-500/20";
      defaultLabel = 'Info';
      break;
    case 'draft':
    case 'archived':
      colorClasses = "bg-muted text-muted-foreground border-border";
      defaultLabel = status === 'draft' ? 'Draft' : 'Archived';
      break;
  }

  return (
    <span className={`${baseClasses} ${colorClasses} ${className}`}>
      {label || defaultLabel}
    </span>
  );
}
