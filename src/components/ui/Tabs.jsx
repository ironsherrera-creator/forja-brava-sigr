export function Tabs({ tabs = [], activeId, onChange, ariaLabel = 'Secciones', className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 border-b border-border-subtle overflow-x-auto ${className}`.trim()}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.id)}
            className={[
              'px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap',
              'border-b-2 transition-colors cursor-pointer bg-transparent',
              isActive
                ? 'border-fire text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary',
              tab.disabled ? 'opacity-45 cursor-not-allowed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
