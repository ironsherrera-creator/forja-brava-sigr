import { getSupabaseClient } from '../lib/supabase';

/**
 * Consulta únicamente categorías activas ordenadas por `display_order` y nombre.
 */
export async function fetchActiveCategories() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('id, slug, name, description, image_url, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'CATEGORIES_FETCH_ERROR',
          message: 'No fue posible cargar las categorías de la carta.',
        },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'CATEGORIES_EXCEPTION',
        message: 'No fue posible conectar para consultar las categorías.',
      },
    };
  }
}
