import { useId, useState } from 'react';

export function Tooltip({ content, position = 'right', children }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  if (!content) return children;

  const posClasses =
    position === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : position === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-2'
        : 'left-full top-1/2 -translate-y-1/2 ml-2.5';

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={[
            'pointer-events-none absolute z-[var(--z-tooltip)] whitespace-nowrap',
            'px-2.5 py-1 text-[11px] font-medium bg-carbon text-cream',
            'border border-sand/25 rounded-[var(--radius-xs)] shadow-[var(--shadow-sm)]',
            posClasses,
          ].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  );
}
