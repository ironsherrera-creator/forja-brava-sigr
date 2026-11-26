export function SectionHeader({
  eyebrow = '',
  title,
  description = '',
  actions = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-4 pb-3 border-b border-border-subtle ${className}`.trim()}
    >
      <div>
        {eyebrow && (
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
            {eyebrow}
          </p>
        )}
        <h2 className="m-0 mt-1 text-2xl font-medium text-text-primary sigr-heading-display">
          {title}
        </h2>
        {description && (
          <p className="m-0 mt-1 text-xs text-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
