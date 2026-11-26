import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistedCart,
  loadPersistedCart,
  savePersistedCart,
} from '../../src/services/cartService';
import {
  buildCartLineKey,
  calculateAddonsUnitTotal,
  calculateCartTotals,
  calculateLineTotal,
  calculateUnitPrice,
  CART_STORAGE_KEY,
  mergeCartItem,
  normalizeQuantity,
  reconcileCartItemsWithCatalog,
  removeCartItem,
  updateCartItemQuantity,
} from '../../src/utils/cartUtils';

describe('cartUtils y cartService — Cálculos, agrupación, persistencia y reconciliación', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('calcula correctamente precio de complementos, valor unitario y total de línea', () => {
    const addons = [
      { id: 'a1', name: 'Queso extra', price: 4500 },
      { id: 'a2', name: 'Tocineta', price: 6000 },
    ];

    expect(calculateAddonsUnitTotal(addons)).toBe(10500);
    expect(calculateUnitPrice(28900, addons)).toBe(39400);
    expect(calculateLineTotal(28900, addons, 3)).toBe(118200);
  });

  it('valida y acota cantidades entre 1 y 99', () => {
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-5)).toBe(1);
    expect(normalizeQuantity('abc')).toBe(1);
    expect(normalizeQuantity(3.9)).toBe(3);
    expect(normalizeQuantity(250)).toBe(99);
  });

  it('agrupa líneas con mismo producto y mismos complementos sin importar orden, y separa complementos distintos', () => {
    const baseItem = {
      productId: 'p1',
      slug: 'forjada',
      name: 'La Forjada',
      unitPrice: 28900,
      quantity: 1,
    };

    const k1 = buildCartLineKey('p1', [
      { id: 'b', name: 'B', price: 1000 },
      { id: 'a', name: 'A', price: 2000 },
    ]);
    const k2 = buildCartLineKey('p1', [
      { id: 'a', name: 'A', price: 2000 },
      { id: 'b', name: 'B', price: 1000 },
    ]);
    expect(k1).toBe(k2);

    let items = mergeCartItem([], {
      ...baseItem,
      addons: [{ id: 'a', name: 'Adición A', price: 5000 }],
    });
    // Misma combinación -> agrupa sumando cantidad
    items = mergeCartItem(items, {
      ...baseItem,
      addons: [{ id: 'a', name: 'Adición A', price: 5000 }],
      quantity: 2,
    });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);

    // Sin complementos -> línea separada
    items = mergeCartItem(items, { ...baseItem, addons: [], quantity: 1 });
    expect(items).toHaveLength(2);

    const totals = calculateCartTotals(items);
    expect(totals.totalUnits).toBe(4);
    expect(totals.subtotal).toBe((28900 + 5000) * 3 + 28900);
  });

  it('incrementa, disminuye, elimina al bajar de 1 y vacía el carrito', () => {
    let items = mergeCartItem([], {
      productId: 'p1',
      slug: 'brava',
      name: 'La Brava',
      unitPrice: 31900,
      addons: [],
      quantity: 2,
    });
    const key = items[0].lineKey;

    items = updateCartItemQuantity(items, key, 4);
    expect(items[0].quantity).toBe(4);

    items = updateCartItemQuantity(items, key, 0);
    expect(items).toHaveLength(0);

    items = mergeCartItem([], {
      productId: 'p2',
      slug: 'criolla',
      name: 'Criolla',
      unitPrice: 29900,
      addons: [],
      quantity: 1,
    });
    items = removeCartItem(items, items[0].lineKey);
    expect(items).toHaveLength(0);
  });

  it('persiste y recupera el carrito en localStorage y limpia datos corruptos de forma segura', () => {
    const items = mergeCartItem([], {
      productId: 'p1',
      slug: 'forjada',
      name: 'La Forjada',
      unitPrice: 28900,
      addons: [{ id: 'ad1', name: 'Adiciones', price: 8900 }],
      quantity: 2,
    });

    savePersistedCart(items);
    const loaded = loadPersistedCart();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('La Forjada');
    expect(loaded[0].quantity).toBe(2);

    // Corromper JSON en localStorage -> debe recuperarse con [] sin lanzar excepción
    window.localStorage.setItem(CART_STORAGE_KEY, '{invalid-json');
    expect(loadPersistedCart()).toEqual([]);

    // Estructura con versión inválida -> debe descartarse
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 999, items: [{ bad: true }] }),
    );
    expect(loadPersistedCart()).toEqual([]);

    savePersistedCart(items);
    clearPersistedCart();
    expect(loadPersistedCart()).toEqual([]);
  });

  it('actualiza precios modificados en Supabase y marca productos o complementos no disponibles', () => {
    let items = mergeCartItem([], {
      productId: 'p1',
      slug: 'forjada',
      name: 'La Forjada',
      unitPrice: 25000,
      addons: [{ id: 'ad1', name: 'Adiciones', price: 8900 }],
      quantity: 1,
    });
    items = mergeCartItem(items, {
      productId: 'p2',
      slug: 'agotado',
      name: 'Producto Retirado',
      unitPrice: 20000,
      addons: [],
      quantity: 1,
    });

    const liveProductsMap = new Map([
      [
        'p1',
        {
          id: 'p1',
          slug: 'forjada',
          name: 'La Forjada',
          price: 28900,
          image_url: 'assets/images/producto-forjada.png',
          is_available: true,
        },
      ],
    ]);

    const liveComplements = new Map([
      ['p1', new Map([['ad1', { id: 'ad1', name: 'Adiciones', price: 8900, is_available: true }]])],
    ]);

    const result = reconcileCartItemsWithCatalog(items, liveProductsMap, liveComplements);
    expect(result.priceChangesCount).toBe(1);
    expect(result.unavailableDetected).toBe(1);

    const updatedP1 = result.items.find((i) => i.productId === 'p1');
    const updatedP2 = result.items.find((i) => i.productId === 'p2');

    expect(updatedP1.unitPrice).toBe(28900);
    expect(updatedP1.priceChanged).toBe(true);
    expect(updatedP1.unavailable).toBe(false);

    expect(updatedP2.unavailable).toBe(true);

    // El subtotal excluye ítems no disponibles
    const totals = calculateCartTotals(result.items);
    expect(totals.hasUnavailableItems).toBe(true);
    expect(totals.subtotal).toBe(28900 + 8900);
  });
});
