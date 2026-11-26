-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 06: Semilla Inicial Idempotente (Roles, Permisos, 4 Categorías,
--               13 Productos oficiales y Configuración provisional base)
-- ============================================================================

-- 1. Roles oficiales
INSERT INTO public.roles (code, name, description)
VALUES
  ('cliente', 'Cliente', 'Cliente registrado con acceso a pedidos, seguimiento y reservas'),
  ('mesero', 'Mesero', 'Personal de servicio en salón (mesas, comandas, entrega y solicitud de cierre)'),
  ('administrador', 'Administrador', 'Administración integral de FORJA BRAVA — SIGR')
ON CONFLICT (code) DO NOTHING;

-- 2. Permisos declarativos base
INSERT INTO public.permissions (code, description)
VALUES
  ('orders.create', 'Crear pedidos validados'),
  ('orders.read_own', 'Consultar y seguir pedidos propios'),
  ('orders.manage_preparation', 'Actualizar estados de preparación (exclusivo admin)'),
  ('orders.deliver_table', 'Marcar pedido de mesa como entregado (D-05)'),
  ('orders.cancel_pending_table', 'Cancelar pedido de mesa en estado Pendiente (D-05)'),
  ('payments.confirm', 'Confirmar pagos simulados y registrarlos en caja abierta'),
  ('payments.refund', 'Registrar reembolsos simulados de pedidos cancelados'),
  ('reservations.create', 'Crear reservas sujetas a disponibilidad'),
  ('reservations.manage', 'Administrar calendario y ocupación de reservas'),
  ('tables.read', 'Consultar estado de mesas'),
  ('tables.manage', 'Configurar inventario de mesas (D-01)'),
  ('table_accounts.request_close', 'Solicitar cierre de cuenta acumulada de mesa (D-04)'),
  ('table_accounts.settle', 'Cobrar y cerrar cuentas acumuladas de mesa en Caja (D-04)'),
  ('catalog.manage', 'Gestionar productos, complementos y categorías'),
  ('users.manage', 'Gestionar usuarios y asignar roles'),
  ('cash.manage', 'Abrir, operar y cerrar turnos de caja'),
  ('reports.read', 'Consultar reportes financieros y auditoría'),
  ('settings.manage', 'Configurar tarifa fija de domicilio (D-03), duración de reservas (D-02) y restaurante')
ON CONFLICT (code) DO NOTHING;

-- Asignación de permisos por rol
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON (
  (r.code = 'administrador')
  OR (r.code = 'cliente' AND p.code IN ('orders.create', 'orders.read_own', 'reservations.create'))
  OR (r.code = 'mesero' AND p.code IN (
    'orders.create',
    'orders.deliver_table',
    'orders.cancel_pending_table',
    'tables.read',
    'table_accounts.request_close'
  ))
)
ON CONFLICT DO NOTHING;

-- 3. Categorías iniciales de la carta existente
INSERT INTO public.categories (slug, name, description, display_order, is_active)
VALUES
  ('hamburguesas', 'Hamburguesas', 'Hamburguesas artesanales a la parrilla con sello colombiano.', 1, true),
  ('perros', 'Perros', 'Perros calientes con ingredientes seleccionados y salsas de la casa.', 2, true),
  ('salchipapas', 'Salchipapas', 'Papas crocantes al punto para compartir o disfrutar al fuego.', 3, true),
  ('colombianos', 'Antojos', 'Clásicos callejeros colombianos y acompañamientos de la casa.', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Catálogo inicial de 13 productos de FORJA BRAVA (conservando precios, descripciones y etiquetas)
WITH cat AS (
  SELECT id, slug FROM public.categories
)
INSERT INTO public.products (
  category_id,
  slug,
  name,
  description,
  price,
  image_url,
  tag,
  is_addon,
  is_available
)
VALUES
  ((SELECT id FROM cat WHERE slug = 'hamburguesas'), 'forjada', 'La Forjada', 'Carne a la parrilla, queso, tocineta y salsa de la casa.', 28900, 'assets/images/producto-forjada.png', 'FAVORITA', false, true),
  ((SELECT id FROM cat WHERE slug = 'hamburguesas'), 'brava', 'La Brava', 'Doble queso, cebolla caramelizada y mayo picante.', 31900, 'assets/images/producto-brava.png', 'PICANTE', false, true),
  ((SELECT id FROM cat WHERE slug = 'hamburguesas'), 'doble-carbon', 'Doble Carbón', 'Dos carnes al carbón, cheddar y pepinillos.', 35900, 'assets/images/producto-doble-carbon.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'hamburguesas'), 'criolla', 'Criolla Especial', 'Carne, hogao casero, queso y papa ripio.', 29900, 'assets/images/producto-criolla.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'perros'), 'perro-tradicional', 'Perro Tradicional', 'Salchicha, ripio, salsas de la casa y queso.', 16900, 'assets/images/producto-perro-tradicional.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'perros'), 'perro-especial', 'Perro Especial', 'Salchicha premium, tocineta, queso y salsa brava.', 21900, 'assets/images/producto-perro-especial.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'perros'), 'perro-colombiano', 'Perro Colombiano', 'Piña, queso, ripio y el toque dulce de la casa.', 23900, 'assets/images/producto-perro-colombiano.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'salchipapas'), 'salchipapa-clasica', 'Salchipapa Clásica', 'Papas crocantes, salchicha y salsas al gusto.', 19900, 'assets/images/producto-salchipapa-clasica.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'salchipapas'), 'salchipapa-especial', 'Salchipapa Especial', 'Papas, salchicha, pollo, queso y salsas.', 27900, 'assets/images/producto-salchipapa-especial.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'salchipapas'), 'salchipapa-mixta', 'Salchipapa Mixta', 'Pollo, carne, salchicha y papas para compartir.', 32900, 'assets/images/producto-salchipapa-mixta.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'colombianos'), 'mazorcada', 'Mazorcada', 'Maíz dulce, pollo, tocineta, queso y salsas.', 26900, 'assets/images/producto-mazorcada.png', 'COLOMBIANA', false, true),
  ((SELECT id FROM cat WHERE slug = 'colombianos'), 'choripapa', 'Choripapa', 'Chorizo a la brasa, papas crocantes y chimichurri.', 24900, 'assets/images/producto-choripapa.png', NULL, false, true),
  ((SELECT id FROM cat WHERE slug = 'colombianos'), 'adiciones', 'Adiciones & Acompañamientos', 'Papas, queso extra, tocineta y salsas de la casa.', 8900, 'assets/images/producto-adiciones.png', 'PARA ACOMPAÑAR', true, true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Vincular explícitamente 'adiciones' como complemento de los platos principales
INSERT INTO public.product_complements (product_id, complement_id)
SELECT p.id, addon.id
FROM public.products p
CROSS JOIN public.products addon
WHERE addon.slug = 'adiciones'
  AND p.slug <> 'adiciones'
ON CONFLICT DO NOTHING;

-- 6. Configuración singleton PROVISIONAL del restaurante
-- IMPORTANTE: Los datos de ubicación, teléfono, tarifa fija de domicilio ($0 provisional, D-03)
-- y duración de reservas (90 min provisional, D-02) están marcados con is_provisional_config = true
-- y deben establecerse definitivamente desde el módulo Configuración (ADM-12).
INSERT INTO public.restaurant_settings (
  id,
  restaurant_name,
  location,
  phone,
  fixed_delivery_fee,
  reservation_duration_minutes,
  reservation_cancel_cutoff_minutes,
  allow_client_table_orders,
  is_provisional_config,
  featured_product_id
)
VALUES (
  1,
  'FORJA BRAVA',
  'Bogotá, Colombia (dirección provisional por configurar)',
  '+57 300 000 0000 (provisional)',
  0,
  90,
  60,
  false,
  true,
  (SELECT id FROM public.products WHERE slug = 'forjada' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;
