export function Skeleton({ className = 'h-4 w-full' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[var(--radius-xs)] bg-surface-muted ${className}`.trim()}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-surface border border-border-subtle rounded-[var(--radius-sm)] p-5 space-y-3"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
