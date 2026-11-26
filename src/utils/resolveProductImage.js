import { LOCAL_IMAGES } from '../assets/images';
import { supabase } from '../lib/supabase';

const FILENAME_TO_LOCAL = {
  'hero-forja-brava.png': LOCAL_IMAGES.hero,
  'producto-forjada.png': LOCAL_IMAGES.products.forjada,
  'producto-brava.png': LOCAL_IMAGES.products.brava,
  'producto-doble-carbon.png': LOCAL_IMAGES.products['doble-carbon'],
  'producto-criolla.png': LOCAL_IMAGES.products.criolla,
  'producto-perro-tradicional.png': LOCAL_IMAGES.products['perro-tradicional'],
  'producto-perro-especial.png': LOCAL_IMAGES.products['perro-especial'],
  'producto-perro-colombiano.png': LOCAL_IMAGES.products['perro-colombiano'],
  'producto-salchipapa-clasica.png': LOCAL_IMAGES.products['salchipapa-clasica'],
  'producto-salchipapa-especial.png': LOCAL_IMAGES.products['salchipapa-especial'],
  'producto-salchipapa-mixta.png': LOCAL_IMAGES.products['salchipapa-mixta'],
  'producto-mazorcada.png': LOCAL_IMAGES.products.mazorcada,
  'producto-choripapa.png': LOCAL_IMAGES.products.choripapa,
  'producto-adiciones.png': LOCAL_IMAGES.products.adiciones,
};

/**
 * Resuelve la URL utilizable de una imagen de producto o categoría:
 * 1. URLs absolutas https:// o http://
 * 2. Rutas locales semilla (`assets/images/...`) mapeadas al bundle de Vite
 * 3. Rutas relativas del bucket de Supabase Storage `product-images`
 */
export function resolveProductImage(imageUrl, slug = '') {
  const raw = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (raw && (raw.startsWith('https://') || raw.startsWith('http://'))) {
    return raw;
  }

  if (raw && raw.startsWith('assets/images/')) {
    const filename = raw.split('/').pop();
    if (filename && FILENAME_TO_LOCAL[filename]) {
      return FILENAME_TO_LOCAL[filename];
    }
  }

  if (raw && supabase) {
    const cleanPath = raw.replace(/^\/+/, '').replace(/^product-images\//, '');
    const { data } = supabase.storage.from('product-images').getPublicUrl(cleanPath);
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  }

  if (slug && LOCAL_IMAGES.products[slug]) {
    return LOCAL_IMAGES.products[slug];
  }

  return '';
}
