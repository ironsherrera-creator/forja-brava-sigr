const MAX_WIDTH_CLASSES = {
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-[var(--content-max-width)]',
  full: 'max-w-full',
};

export function ContentContainer({
  size = 'xl',
  className = '',
  children,
}) {
  return (
    <div
      className={[
        'w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8',
        MAX_WIDTH_CLASSES[size] || MAX_WIDTH_CLASSES.xl,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
