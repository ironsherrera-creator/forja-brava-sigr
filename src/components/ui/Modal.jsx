import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description = '',
  size = 'md',
  footer = null,
  children,
}) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-carbon/70 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={[
          'w-full bg-surface text-text-primary border border-border rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)]',
          'max-h-[90vh] flex flex-col outline-none',
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border-subtle">
          <div>
            {title && (
              <h2
                id={titleId}
                className="m-0 text-xl font-medium text-text-primary sigr-heading-display"
              >
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="m-0 mt-1 text-xs text-text-secondary">
                {description}
              </p>
            )}
          </div>
          <IconButton
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            label="Cerrar ventana"
            size="sm"
            onClick={onClose}
          />
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-border-subtle bg-surface-muted/50 flex flex-wrap items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
