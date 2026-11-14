import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

/**
 * A single skeleton block with a shimmer sweep, not a flat pulse — the
 * `shimmer` keyframe/animation (tooling/tailwind-config) existed but was
 * never actually used anywhere. The sweep is a separate absolutely
 * positioned layer so the base block can still be any shape/size via
 * `className`; `-translate-x-full` is its resting position, the `shimmer`
 * keyframe's only defined state (`100%`) becomes the sweep's end position,
 * so the animation interpolates from off-left to off-right automatically.
 */
export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`relative overflow-hidden bg-muted rounded-md ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}
