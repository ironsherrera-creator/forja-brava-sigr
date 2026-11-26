import { getSupabaseClient } from '../lib/supabase';
import { fetchActiveCategories } from './categoryService';
import { fetchPublicProducts } from './productService';

const DAY_LABELS = [
  ['monday', 'Lun'],
  ['tuesday', 'Mar'],
  ['wednesday', 'Mié'],
  ['thursday', 'Jue'],
  ['friday', 'Vie'],
  ['saturday', 'Sáb'],
  ['sunday', 'Dom'],
];

export function formatBusinessHoursList(businessHours) {
  if (!businessHours || typeof businessHours !== 'object') return [];

  return DAY_LABELS.map(([key, label]) => {
    const cfg = businessHours[key];
    if (!cfg || typeof cfg !== 'object') return null;
    if (cfg.closed) {
      return { day: label, schedule: 'Cerrado' };
    }
    if (!cfg.open || !cfg.close) return null;
    return { day: label, schedule: `${cfg.open} – ${cfg.close}` };
  }).filter(Boolean);
}

export async function fetchRestaurantSettings() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurant_settings')
      .select(
        'id, restaurant_name, location, phone, whatsapp_number, instagram_url, facebook_url, business_hours, fixed_delivery_fee, reservation_duration_minutes, allow_client_table_orders, is_provisional_config, featured_product_id',
      )
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'SETTINGS_FETCH_ERROR',
          message: 'No fue posible consultar la configuración del restaurante.',
        },
      };
    }

    return { data: data ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'SETTINGS_EXCEPTION',
        message: 'No fue posible conectar con el servidor del restaurante.',
      },
    };
  }
}

export async function fetchLandingData() {
  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    fetchRestaurantSettings(),
    fetchActiveCategories(),
    fetchPublicProducts({ includeAddons: false }),
  ]);

  const firstError =
    settingsRes.error || categoriesRes.error || productsRes.error || null;

  const products = productsRes.data || [];
  const featuredId = settingsRes.data?.featured_product_id || null;

  const heroFeaturedProduct =
    products.find((p) => p.id === featuredId) ||
    products.find((p) => Boolean(p.tag)) ||
    products[0] ||
    null;

  // Destacados: primero los que poseen etiqueta editorial (`tag`) o el protagonista configurado
  const taggedProducts = products.filter(
    (p) => Boolean(p.tag) || p.id === featuredId,
  );
  const highlightedProducts =
    taggedProducts.length >= 4 ? taggedProducts.slice(0, 4) : products.slice(0, 4);

  return {
    settings: settingsRes.data,
    categories: categoriesRes.data || [],
    products,
    featuredProduct: heroFeaturedProduct,
    highlightedProducts,
    error: firstError,
  };
}
