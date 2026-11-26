import { useEffect, useRef, useState } from 'react';

export function Dropdown({
  trigger,
  align = 'right',
  menuLabel = 'Opciones',
  className = '',
  children,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const toggle = () => setOpen((prev) => !prev);

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`.trim()}>
      {typeof trigger === 'function' ? (
        trigger({ open, toggle, close })
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className="cursor-pointer bg-transparent border-0 p-0"
        >
          {trigger}
        </button>
      )}

      {open && (
        <div
          role="menu"
          aria-label={menuLabel}
          className={[
            'absolute top-full mt-2 min-w-[220px] z-[var(--z-dropdown)]',
            'bg-surface-elevated text-text-primary border border-border',
            'rounded-[var(--radius-sm)] shadow-[var(--shadow-md)] py-1.5',
            align === 'left' ? 'left-0' : 'right-0',
          ].join(' ')}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}
