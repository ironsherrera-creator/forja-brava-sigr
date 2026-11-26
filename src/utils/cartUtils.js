export const CART_STORAGE_KEY = 'forja-brava-cart-v1';
export const CART_SCHEMA_VERSION = 1;
export const MAX_ITEM_QUANTITY = 99;

export function toSafeMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
}

export function normalizeQuantity(quantity) {
  const parsed = Math.floor(Number(quantity));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_ITEM_QUANTITY);
}

export function normalizeAddons(addons = []) {
  if (!Array.isArray(addons)) return [];

  const uniqueMap = new Map();
  for (const addon of addons) {
    if (!addon || !addon.id) continue;
    uniqueMap.set(String(addon.id), {
      id: String(addon.id),
      name: String(addon.name || 'Complemento'),
      price: toSafeMoney(addon.price),
    });
  }

  return Array.from(uniqueMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Construye una clave determinista por producto + combinación exacta de complementos.
 * Dos líneas solo se agrupan si tienen el mismo producto y exactamente los mismos complementos.
 */
export function buildCartLineKey(productId, addons = []) {
  const normalized = normalizeAddons(addons);
  const addonSignature = normalized.map((item) => item.id).join(',');
  return `${String(productId)}::${addonSignature}`;
}

export function calculateAddonsUnitTotal(addons = []) {
  const normalized = normalizeAddons(addons);
  return toSafeMoney(normalized.reduce((acc, addon) => acc + addon.price, 0));
}

export function calculateUnitPrice(basePrice, addons = []) {
  return toSafeMoney(toSafeMoney(basePrice) + calculateAddonsUnitTotal(addons));
}

export function calculateLineTotal(basePrice, addons = [], quantity = 1) {
  const safeQty = normalizeQuantity(quantity);
  return toSafeMoney(calculateUnitPrice(basePrice, addons) * safeQty);
}

export function calculateCartTotals(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      totalUnits: 0,
      subtotal: 0,
      unavailableCount: 0,
      hasUnavailableItems: false,
      hasPriceChanges: false,
    };
  }

  let totalUnits = 0;
  let subtotal = 0;
  let unavailableCount = 0;
  let hasPriceChanges = false;

  for (const item of items) {
    const qty = normalizeQuantity(item.quantity);
    totalUnits += qty;
    if (item.unavailable) {
      unavailableCount += 1;
    } else {
      subtotal += calculateLineTotal(item.unitPrice, item.addons, qty);
    }
    if (item.priceChanged) {
      hasPriceChanges = true;
    }
  }

  return {
    totalUnits,
    subtotal: toSafeMoney(subtotal),
    unavailableCount,
    hasUnavailableItems: unavailableCount > 0,
    hasPriceChanges,
  };
}

export function mergeCartItem(currentItems = [], incomingItem) {
  const normalizedAddons = normalizeAddons(incomingItem.addons);
  const lineKey = buildCartLineKey(incomingItem.productId, normalizedAddons);
  const incomingQty = normalizeQuantity(incomingItem.quantity);

  const existingIndex = currentItems.findIndex((item) => item.lineKey === lineKey);

  if (existingIndex === -1) {
    return [
      ...currentItems,
      {
        lineKey,
        productId: String(incomingItem.productId),
        slug: String(incomingItem.slug || ''),
        name: String(incomingItem.name || ''),
        imageUrl: String(incomingItem.imageUrl || ''),
        categoryName: String(incomingItem.categoryName || ''),
        unitPrice: toSafeMoney(incomingItem.unitPrice),
        addons: normalizedAddons,
        quantity: incomingQty,
        unavailable: false,
        unavailableReason: '',
        priceChanged: false,
        previousUnitPrice: null,
      },
    ];
  }

  return currentItems.map((item, idx) =>
    idx === existingIndex
      ? {
          ...item,
          name: String(incomingItem.name || item.name),
          imageUrl: String(incomingItem.imageUrl || item.imageUrl),
          unitPrice: toSafeMoney(incomingItem.unitPrice),
          addons: normalizedAddons,
          quantity: normalizeQuantity(item.quantity + incomingQty),
          unavailable: false,
          unavailableReason: '',
        }
      : item,
  );
}

export function updateCartItemQuantity(currentItems = [], lineKey, nextQuantity) {
  const parsed = Math.floor(Number(nextQuantity));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return currentItems.filter((item) => item.lineKey !== lineKey);
  }

  const safeQty = Math.min(parsed, MAX_ITEM_QUANTITY);
  return currentItems.map((item) =>
    item.lineKey === lineKey ? { ...item, quantity: safeQty } : item,
  );
}

export function removeCartItem(currentItems = [], lineKey) {
  return currentItems.filter((item) => item.lineKey !== lineKey);
}

/**
 * Reconcilia las líneas persistidas en localStorage contra los datos vigentes de Supabase.
 * - Actualiza precios si cambiaron en servidor y marca `priceChanged`.
 * - Marca como no disponible si el producto o alguno de sus complementos dejó de estar activo/vinculado.
 */
export function reconcileCartItemsWithCatalog(
  currentItems = [],
  liveProductsMap = new Map(),
  liveComplementsByProduct = new Map(),
) {
  let priceChangesCount = 0;
  let unavailableDetected = 0;

  const reconciled = currentItems.map((item) => {
    const liveProduct = liveProductsMap.get(item.productId);

    if (!liveProduct || liveProduct.is_available === false) {
      unavailableDetected += 1;
      return {
        ...item,
        unavailable: true,
        unavailableReason: 'Este producto ya no está disponible en la carta.',
      };
    }

    const allowedComplements = liveComplementsByProduct.get(item.productId) || new Map();
    const updatedAddons = [];
    let addonUnavailableReason = '';

    for (const addon of item.addons || []) {
      const liveAddon = allowedComplements.get(addon.id);
      if (!liveAddon || liveAddon.is_available === false) {
        addonUnavailableReason = `El complemento "${addon.name}" ya no está disponible para este producto.`;
        updatedAddons.push(addon);
      } else {
        updatedAddons.push({
          id: liveAddon.id,
          name: liveAddon.name,
          price: toSafeMoney(liveAddon.price),
        });
      }
    }

    if (addonUnavailableReason) {
      unavailableDetected += 1;
      return {
        ...item,
        name: liveProduct.name,
        slug: liveProduct.slug,
        unitPrice: toSafeMoney(liveProduct.price),
        addons: updatedAddons,
        unavailable: true,
        unavailableReason: addonUnavailableReason,
      };
    }

    const prevUnitTotal = calculateUnitPrice(item.unitPrice, item.addons);
    const nextUnitTotal = calculateUnitPrice(liveProduct.price, updatedAddons);
    const priceChanged = prevUnitTotal !== nextUnitTotal;

    if (priceChanged) {
      priceChangesCount += 1;
    }

    return {
      ...item,
      name: liveProduct.name,
      slug: liveProduct.slug,
      imageUrl: liveProduct.image_url || item.imageUrl,
      unitPrice: toSafeMoney(liveProduct.price),
      addons: normalizeAddons(updatedAddons),
      unavailable: false,
      unavailableReason: '',
      priceChanged,
      previousUnitPrice: priceChanged ? prevUnitTotal : null,
    };
  });

  return {
    items: reconciled,
    priceChangesCount,
    unavailableDetected,
  };
}
