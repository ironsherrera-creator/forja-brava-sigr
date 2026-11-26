import { getSupabaseClient } from '../lib/supabase';

const PRODUCT_SELECT_COLUMNS =
  'id, category_id, slug, name, description, ingredients, price, image_url, tag, is_addon, is_available, created_at, categories ( id, slug, name, description, display_order, is_active )';

function normalizeProduct(row) {
  if (!row) return null;
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    ...row,
    price: Number(row.price) || 0,
    category: category || null,
  };
}

/**
 * Consulta productos visibles en la carta pública filtrados en servidor/cliente
 * respetando RLS (`is_available = true` para `anon`).
 */
export async function fetchPublicProducts({
  categorySlug = '',
  search = '',
  sort = 'featured',
  includeAddons = true,
} = {}) {
  try {
    const client = getSupabaseClient();
    let query = client
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .eq('is_available', true);

    if (!includeAddons) {
      query = query.eq('is_addon', false);
    }

    const cleanSearch = String(search || '').trim();
    if (cleanSearch) {
      query = query.ilike('name', `%${cleanSearch}%`);
    }

    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true }).order('name', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false }).order('name', { ascending: true });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      default:
        query = query
          .order('is_addon', { ascending: true })
          .order('created_at', { ascending: true });
        break;
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'PRODUCTS_FETCH_ERROR',
          message: 'No fue posible cargar los productos del menú.',
        },
      };
    }

    let normalized = (data ?? [])
      .map(normalizeProduct)
      .filter((item) => item && item.category?.is_active !== false);

    if (categorySlug) {
      normalized = normalized.filter(
        (item) => item.category?.slug === categorySlug,
      );
    }

    return { data: normalized, error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'PRODUCTS_EXCEPTION',
        message: 'No fue posible conectar para consultar el menú.',
      },
    };
  }
}

export async function fetchProductBySlug(slug) {
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) {
    return {
      data: null,
      error: { code: 'INVALID_SLUG', message: 'Producto no especificado.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'PRODUCT_DETAIL_ERROR',
          message: 'No fue posible cargar el detalle del producto.',
        },
      };
    }

    if (!data) {
      return {
        data: null,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'El producto solicitado no existe o no está disponible actualmente.',
        },
      };
    }

    return { data: normalizeProduct(data), error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'PRODUCT_DETAIL_EXCEPTION',
        message: 'No fue posible conectar para consultar este producto.',
      },
    };
  }
}

export async function fetchProductsByIds(productIds = []) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { data: [], error: null };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('products')
      .select('id, slug, name, price, image_url, is_available, is_addon')
      .in('id', uniqueIds);

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'PRODUCTS_BY_IDS_ERROR',
          message: 'No fue posible verificar la disponibilidad de los productos.',
        },
      };
    }

    return {
      data: (data ?? []).map((row) => ({ ...row, price: Number(row.price) || 0 })),
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'PRODUCTS_BY_IDS_EXCEPTION',
        message: 'Error de conexión al verificar el carrito.',
      },
    };
  }
}
