export function PageHeader({
  eyebrow = '',
  title,
  accent = '',
  description = '',
  badge = null,
  actions = null,
  className = '',
}) {
  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6 mb-6 border-b border-border-subtle ${className}`.trim()}
    >
      <div className="min-w-0">
        {(eyebrow || badge) && (
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            {eyebrow && (
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                {eyebrow}
              </span>
            )}
            {badge}
          </div>
        )}
        <h1 className="m-0 text-3xl sm:text-4xl font-medium leading-tight text-text-primary sigr-heading-display">
          {title}
          {accent ? (
            <>
              {' '}
              <em className="text-fire font-medium">{accent}</em>
            </>
          ) : null}
        </h1>
        {description && (
          <p className="m-0 mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
