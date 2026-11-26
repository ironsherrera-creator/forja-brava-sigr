import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { resolveProductImage } from '../../utils/resolveProductImage';

export function ProductImage({
  imageUrl,
  slug = '',
  alt = '',
  className = 'w-full h-full object-cover',
}) {
  const [failedSrc, setFailedSrc] = useState('');
  const src = resolveProductImage(imageUrl, slug);
  const hasValidSrc = Boolean(src) && failedSrc !== src;

  if (!hasValidSrc) {
    return (
      <div
        role="img"
        aria-label={alt || 'Imagen no disponible'}
        className="w-full h-full flex flex-col items-center justify-center gap-2 bg-coffee/70 text-sand/70 p-4 text-center"
      >
        <UtensilsCrossed className="h-7 w-7 text-fire/80" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          Imagen no disponible
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
