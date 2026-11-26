import { getSupabaseClient } from '../lib/supabase';

/**
 * Consulta los complementos activos vinculados a un producto específico
 * mediante la tabla relacional `product_complements`.
 */
export async function fetchComplementsForProduct(productId) {
  if (!productId) return { data: [], error: null };

  try {
    const client = getSupabaseClient();
    const { data: relations, error: relError } = await client
      .from('product_complements')
      .select('complement_id')
      .eq('product_id', productId);

    if (relError) {
      return {
        data: [],
        error: {
          code: relError.code || 'COMPLEMENTS_REL_ERROR',
          message: 'No fue posible cargar los complementos del producto.',
        },
      };
    }

    const complementIds = (relations ?? []).map((r) => r.complement_id).filter(Boolean);
    if (complementIds.length === 0) {
      return { data: [], error: null };
    }

    const { data: addons, error: addonsError } = await client
      .from('products')
      .select('id, slug, name, description, price, image_url, is_addon, is_available')
      .in('id', complementIds)
      .eq('is_addon', true)
      .eq('is_available', true)
      .order('name', { ascending: true });

    if (addonsError) {
      return {
        data: [],
        error: {
          code: addonsError.code || 'COMPLEMENTS_FETCH_ERROR',
          message: 'No fue posible consultar el precio de los complementos.',
        },
      };
    }

    return {
      data: (addons ?? []).map((addon) => ({
        ...addon,
        price: Number(addon.price) || 0,
      })),
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'COMPLEMENTS_EXCEPTION',
        message: 'Error de conexión al cargar complementos.',
      },
    };
  }
}

/**
 * Consulta en lote las relaciones `product_complements` para múltiples productos
 * (evita consultas N+1 tanto en el menú como en la reconciliación del carrito).
 */
export async function fetchComplementsMapForProducts(productIds = []) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  const resultMap = new Map();

  if (uniqueIds.length === 0) {
    return { data: resultMap, error: null };
  }

  try {
    const client = getSupabaseClient();
    const { data: relations, error: relError } = await client
      .from('product_complements')
      .select('product_id, complement_id')
      .in('product_id', uniqueIds);

    if (relError) {
      return {
        data: resultMap,
        error: {
          code: relError.code || 'COMPLEMENTS_BATCH_ERROR',
          message: 'No fue posible verificar los complementos disponibles.',
        },
      };
    }

    const allComplementIds = Array.from(
      new Set((relations ?? []).map((r) => r.complement_id).filter(Boolean)),
    );

    if (allComplementIds.length === 0) {
      return { data: resultMap, error: null };
    }

    const { data: addons, error: addonsError } = await client
      .from('products')
      .select('id, name, price, is_addon, is_available')
      .in('id', allComplementIds)
      .eq('is_addon', true)
      .eq('is_available', true);

    if (addonsError) {
      return {
        data: resultMap,
        error: {
          code: addonsError.code || 'COMPLEMENTS_BATCH_PRODUCTS_ERROR',
          message: 'No fue posible validar los complementos en la carta.',
        },
      };
    }

    const addonsById = new Map(
      (addons ?? []).map((addon) => [
        addon.id,
        { ...addon, price: Number(addon.price) || 0 },
      ]),
    );

    for (const rel of relations ?? []) {
      const addon = addonsById.get(rel.complement_id);
      if (!addon) continue;
      if (!resultMap.has(rel.product_id)) {
        resultMap.set(rel.product_id, new Map());
      }
      resultMap.get(rel.product_id).set(addon.id, addon);
    }

    return { data: resultMap, error: null };
  } catch (err) {
    return {
      data: resultMap,
      error: {
        code: err.code || 'COMPLEMENTS_BATCH_EXCEPTION',
        message: 'Error de conexión al validar complementos.',
      },
    };
  }
}
