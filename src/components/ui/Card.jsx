export function Card({ children, className = '', padded = true, ...props }) {
  return (
    <section
      className={[
        'bg-surface border border-border-subtle rounded-[var(--radius-sm)] shadow-[var(--shadow-xs)]',
        padded ? 'p-5 sm:p-6' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-border-subtle ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`m-0 text-lg font-medium text-text-primary sigr-heading-display ${className}`.trim()}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`m-0 mt-1 text-xs leading-relaxed text-text-secondary ${className}`.trim()}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div
      className={`mt-5 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
