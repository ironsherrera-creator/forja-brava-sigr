import { persistedCartSchema } from '../schemas/cartSchemas';
import {
  CART_SCHEMA_VERSION,
  CART_STORAGE_KEY,
  reconcileCartItemsWithCatalog,
} from '../utils/cartUtils';
import { fetchComplementsMapForProducts } from './complementService';
import { fetchProductsByIds } from './productService';

export function loadPersistedCart() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsedJson = JSON.parse(raw);
    const validated = persistedCartSchema.safeParse(parsedJson);
    if (!validated.success) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }

    return validated.data.items;
  } catch {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignorar errores de cuota/privacidad de storage
    }
    return [];
  }
}

export function savePersistedCart(items = []) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const payload = {
      version: CART_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      items,
    };
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Fallback silencioso si el navegador restringe localStorage
  }
}

export function clearPersistedCart() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignorar
  }
}

/**
 * Revalida todo el carrito persistido contra precios y disponibilidad reales en Supabase.
 */
export async function syncCartWithSupabase(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      items: [],
      priceChangesCount: 0,
      unavailableDetected: 0,
      error: null,
    };
  }

  const productIds = items.map((item) => item.productId);
  const [productsRes, complementsRes] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchComplementsMapForProducts(productIds),
  ]);

  if (productsRes.error || complementsRes.error) {
    return {
      items,
      priceChangesCount: 0,
      unavailableDetected: 0,
      error: productsRes.error || complementsRes.error,
    };
  }

  const liveProductsMap = new Map(
    (productsRes.data || []).map((product) => [product.id, product]),
  );

  const reconciled = reconcileCartItemsWithCatalog(
    items,
    liveProductsMap,
    complementsRes.data,
  );

  return {
    ...reconciled,
    error: null,
  };
}
