-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 02: Dominio de Catálogo (Categorías, Productos, Complementos)
--               y Configuración Global del Restaurante
-- ============================================================================

-- 2.1. Categorías dinámicas del menú
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name varchar(80) NOT NULL UNIQUE CHECK (char_length(btrim(name)) >= 2),
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_active_order
  ON public.categories (is_active, display_order);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2.2. Productos y complementos del catálogo
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  slug varchar(100) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name varchar(120) NOT NULL CHECK (char_length(btrim(name)) >= 2),
  description text NOT NULL DEFAULT '',
  ingredients text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  image_url text,
  tag varchar(40),
  is_addon boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_available
  ON public.products (category_id, is_available);

CREATE INDEX IF NOT EXISTS idx_products_addons_available
  ON public.products (is_addon)
  WHERE is_available = true;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2.3. Relación explícita Producto <-> Complementos permitidos
CREATE TABLE IF NOT EXISTS public.product_complements (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  complement_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, complement_id),
  CONSTRAINT chk_product_complement_distinct CHECK (product_id <> complement_id)
);

CREATE INDEX IF NOT EXISTS idx_product_complements_complement
  ON public.product_complements (complement_id);

-- 2.4. Configuración singleton del restaurante (D-02, D-03 y parámetros provisionales)
-- Nota: Los valores por defecto son PROVISIONALES y deben actualizarse en Administración (ADM-12).
-- allow_client_table_orders permanece en false por defecto hasta decisión funcional explícita (P-05).
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name varchar(120) NOT NULL DEFAULT 'FORJA BRAVA',
  location varchar(200) NOT NULL DEFAULT 'Bogotá, Colombia (dirección provisional por configurar)',
  phone varchar(40) NOT NULL DEFAULT '+57 300 000 0000 (provisional)',
  whatsapp_number varchar(30) DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  business_hours jsonb NOT NULL DEFAULT '{
    "monday":    {"open": "12:00", "close": "22:00", "closed": false},
    "tuesday":   {"open": "12:00", "close": "22:00", "closed": false},
    "wednesday": {"open": "12:00", "close": "22:00", "closed": false},
    "thursday":  {"open": "12:00", "close": "22:00", "closed": false},
    "friday":    {"open": "12:00", "close": "23:00", "closed": false},
    "saturday":  {"open": "12:00", "close": "23:00", "closed": false},
    "sunday":    {"open": "12:00", "close": "22:00", "closed": false}
  }'::jsonb,
  fixed_delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (fixed_delivery_fee >= 0),
  reservation_duration_minutes smallint NOT NULL DEFAULT 90 CHECK (reservation_duration_minutes >= 15),
  reservation_cancel_cutoff_minutes smallint NOT NULL DEFAULT 60 CHECK (reservation_cancel_cutoff_minutes >= 0),
  allow_client_table_orders boolean NOT NULL DEFAULT false,
  is_provisional_config boolean NOT NULL DEFAULT true,
  featured_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at
  BEFORE UPDATE ON public.restaurant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
