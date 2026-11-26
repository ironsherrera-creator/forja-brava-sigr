import { getSupabaseClient } from '../lib/supabase';

function toSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export async function fetchAllAdminCategories() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('id, slug, name, description, image_url, display_order, is_active, updated_at')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: { code: error.code, message: 'No fue posible cargar las categorías.' } };
    }
    return { data: data ?? [], error: null };
  } catch (err) {
    return { data: [], error: { code: err.code, message: 'Error de conexión al consultar categorías.' } };
  }
}

export async function saveAdminCategory(categoryId, input) {
  const name = String(input.name || '').trim();
  const slug = toSlug(input.slug || name);
  if (name.length < 2 || !slug) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'El nombre de la categoría debe tener al menos 2 caracteres.' },
    };
  }

  const payload = {
    name,
    slug,
    description: String(input.description || '').trim() || null,
    display_order: Math.max(0, Number(input.display_order) || 0),
    is_active: Boolean(input.is_active),
  };

  try {
    const client = getSupabaseClient();
    const query = categoryId
      ? client.from('categories').update(payload).eq('id', categoryId)
      : client.from('categories').insert(payload);

    const { data, error } = await query
      .select('id, slug, name, description, image_url, display_order, is_active')
      .single();

    if (error) {
      const msg =
        error.code === '23505'
          ? 'Ya existe una categoría con ese nombre o slug.'
          : 'No fue posible guardar la categoría.';
      return { data: null, error: { code: error.code, message: msg } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: 'Error de conexión al guardar la categoría.' } };
  }
}

export async function fetchAllAdminProducts() {
  try {
    const client = getSupabaseClient();
    const [prodRes, compRes] = await Promise.all([
      client
        .from('products')
        .select(
          'id, category_id, slug, name, description, ingredients, price, image_url, tag, is_addon, is_available, created_at, categories ( id, name, slug )',
        )
        .order('is_addon', { ascending: true })
        .order('name', { ascending: true }),
      client.from('product_complements').select('product_id, complement_id'),
    ]);

    if (prodRes.error) {
      return { data: [], error: { code: prodRes.error.code, message: 'No fue posible cargar los productos.' } };
    }

    const compByProduct = new Map();
    for (const rel of compRes.data ?? []) {
      const list = compByProduct.get(rel.product_id) ?? [];
      list.push(rel.complement_id);
      compByProduct.set(rel.product_id, list);
    }

    const rows = (prodRes.data ?? []).map((p) => ({
      ...p,
      price: Number(p.price) || 0,
      category: Array.isArray(p.categories) ? p.categories[0] : p.categories,
      complement_ids: compByProduct.get(p.id) ?? [],
    }));

    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: { code: err.code, message: 'Error de conexión al cargar productos.' } };
  }
}

export async function uploadProductImage(file) {
  if (!file) return { url: null, error: null };
  const allowed = ['image/webp', 'image/png', 'image/jpeg'];
  if (!allowed.includes(file.type)) {
    return { url: null, error: { code: 'INVALID_MIME', message: 'Solo se permiten imágenes PNG, JPG o WEBP.' } };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { url: null, error: { code: 'FILE_TOO_LARGE', message: 'La imagen no debe superar 2 MB.' } };
  }

  try {
    const client = getSupabaseClient();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const filePath = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await client.storage.from('product-images').upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      return { url: null, error: { code: error.code, message: 'No fue posible subir la imagen al almacenamiento.' } };
    }
    const { data } = client.storage.from('product-images').getPublicUrl(filePath);
    return { url: data?.publicUrl || filePath, error: null };
  } catch (err) {
    return { url: null, error: { code: err.code, message: 'Error de conexión al subir la imagen.' } };
  }
}

const PRODUCT_RPC_ERROR_MAP = [
  ['INVALID_COMPLEMENT_SELF', 'Un producto no puede asociarse como complemento de sí mismo.'],
  ['INVALID_COMPLEMENT', 'Uno de los complementos seleccionados no existe o no está marcado como adición válida.'],
  ['CATEGORY_NOT_FOUND', 'La categoría seleccionada no existe.'],
  ['PRODUCT_NOT_FOUND', 'El producto indicado no existe.'],
  ['INVALID_PRODUCT_NAME', 'El nombre del producto es obligatorio (mínimo 2 caracteres).'],
  ['INVALID_PRODUCT_SLUG', 'El identificador (slug) del producto no tiene un formato válido.'],
  ['INVALID_PRICE', 'El precio debe ser mayor o igual a 0 con precisión monetaria válida (máximo 2 decimales).'],
  ['FORBIDDEN_ROLE', 'Solo el administrador puede gestionar productos y complementos.'],
];

function mapAdminProductRpcError(error) {
  if (error?.code === '23505') {
    return 'Ya existe un producto con ese slug.';
  }
  const raw = String(error?.message || '');
  for (const [code, friendly] of PRODUCT_RPC_ERROR_MAP) {
    if (raw.includes(code)) return friendly;
  }
  return 'No fue posible guardar el producto.';
}

export async function saveAdminProduct(productId, input, { syncComplements = true } = {}) {
  const name = String(input.name || '').trim();
  const slug = toSlug(input.slug || name);
  const price = Number(input.price);
  if (name.length < 2 || !slug) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El nombre del producto es obligatorio (mínimo 2 caracteres).',
      },
    };
  }
  if (!input.category_id) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Debes asociar una categoría.' },
    };
  }
  if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El precio debe ser mayor o igual a 0 con hasta 2 decimales.',
      },
    };
  }

  const complementIds = Array.isArray(input.complement_ids)
    ? Array.from(new Set(input.complement_ids.filter(Boolean)))
    : [];

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_save_product', {
      p_product_id: productId || null,
      p_category_id: input.category_id,
      p_name: name,
      p_slug: slug,
      p_description: String(input.description || '').trim(),
      p_ingredients: String(input.ingredients || '').trim() || null,
      p_price: price,
      p_image_url: String(input.image_url || '').trim() || null,
      p_tag: String(input.tag || '').trim() || null,
      p_is_addon: Boolean(input.is_addon),
      p_is_available: Boolean(input.is_available),
      p_complement_ids: complementIds,
      p_sync_complements: Boolean(syncComplements),
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADMIN_SAVE_PRODUCT_ERROR',
          message: mapAdminProductRpcError(error),
        },
      };
    }

    return {
      data: data ? { ...data, price: Number(data.price) || 0 } : null,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADMIN_SAVE_PRODUCT_EXCEPTION',
        message: mapAdminProductRpcError(err),
      },
    };
  }
}
