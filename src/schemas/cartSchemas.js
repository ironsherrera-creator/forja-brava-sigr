import { z } from 'zod';
import { CART_SCHEMA_VERSION, MAX_ITEM_QUANTITY } from '../utils/cartUtils';

export const cartAddonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  price: z.number().finite().min(0),
});

export const cartItemSchema = z.object({
  lineKey: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().default(''),
  name: z.string().min(1).max(160),
  imageUrl: z.string().default(''),
  categoryName: z.string().default(''),
  unitPrice: z.number().finite().min(0),
  addons: z.array(cartAddonSchema).default([]),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
  unavailable: z.boolean().default(false),
  unavailableReason: z.string().default(''),
  priceChanged: z.boolean().default(false),
  previousUnitPrice: z.number().finite().min(0).nullable().default(null),
});

export const persistedCartSchema = z.object({
  version: z.literal(CART_SCHEMA_VERSION),
  updatedAt: z.string().optional(),
  items: z.array(cartItemSchema).default([]),
});

export const catalogFilterSchema = z.object({
  category: z.string().trim().max(80).default(''),
  search: z.string().trim().max(100).default(''),
  sort: z
    .enum(['featured', 'price_asc', 'price_desc', 'name_asc'])
    .default('featured'),
  availability: z.enum(['all', 'available']).default('available'),
});
