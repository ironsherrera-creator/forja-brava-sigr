import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export function Drawer({
  open,
  onClose,
  title = '',
  side = 'left',
  tone = 'dark',
  className = '',
  children,
}) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const isDark = tone === 'dark';

  return (
    <div
      className={[
        'fixed inset-0 z-[var(--z-drawer)] flex bg-carbon/70 backdrop-blur-[2px]',
        side === 'right' ? 'justify-end' : 'justify-start',
      ].join(' ')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? 'Panel de navegación' : undefined}
        tabIndex={-1}
        className={[
          'w-[min(310px,88vw)] h-full flex flex-col shadow-[var(--shadow-lg)] outline-none',
          isDark
            ? 'bg-carbon text-cream border-r border-sand/15'
            : 'bg-surface text-text-primary border-r border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            'flex items-center justify-between gap-3 px-4 py-3.5 border-b',
            isDark ? 'border-sand/15' : 'border-border-subtle',
          ].join(' ')}
        >
          {title ? (
            <span
              id={titleId}
              className="text-xs font-bold uppercase tracking-[0.14em]"
            >
              {title}
            </span>
          ) : (
            <span />
          )}
          <IconButton
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            label="Cerrar panel"
            variant={isDark ? 'dark' : 'ghost'}
            size="sm"
            onClick={onClose}
          />
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
