# Estrategia de Persistencia y Sincronización
## FORJA BRAVA — SIGR

Define qué información migra definitivamente a **PostgreSQL (Supabase)**, qué estado efímero permanece en el navegador y cómo se sincronizan las cuatro experiencias en tiempo real.

---

## 1. Reemplazo del modelo de persistencia actual

| Clave actual en navegador | Estado actual | Destino en arquitectura objetivo |
|---|---|---|
| `forja-sigr-demo` (`localStorage`) | Almacena `products`, `orders`, `reservations`, `cashClosures`. | **ELIMINADO.** Migrado completamente a tablas relacionales en **PostgreSQL (Supabase)**. |
| `forja-clientes-demo` (`localStorage`) | Almacena cuentas y hashes `PBKDF2` de clientes. | **ELIMINADO.** Migrado a **Supabase Auth** (`auth.users`) + `public.profiles`. |
| `forja-cliente-session` (`sessionStorage`) | Guarda UUID en texto plano del cliente. | **ELIMINADO.** Reemplazado por sesión JWT gestionada por Supabase Auth. |
| `forja-admin` (`sessionStorage`) | Bandera `'1'` trivialmente manipulable. | **ELIMINADO.** Reemplazado por sesión JWT + verificación de rol en `profiles` y RLS. |
| `forja-cart` (`localStorage`) | Arreglo `[productId, qty]`. | **CONSERVADO Y MEJORADO** exclusivamente como borrador temporal del carrito previo al checkout (`forja-cart-v2`: `{ productId, qty, addonIds[], notes }`), siempre revalidado contra precios del servidor al comprar. |

---

## 2. Sincronización en tiempo real (Supabase Realtime)

En lugar de los `StorageEvent` sintéticos actuales (que solo funcionan en un mismo navegador), se habilitan canales Realtime sobre PostgreSQL para:
1. **Seguimiento del cliente (`CLI-07`):** Suscripción filtrada por `order_id` para reflejar al instante los cambios de estado ejecutados por el administrador o la entrega del mesero.
2. **Operación del mesero (`MES-01`, `MES-02`, `MES-04`):** Suscripción a `restaurant_tables`, `table_accounts` y `orders` (modalidad `mesa`) para recibir alertas cuando un pedido pasa a `Listo` y ver cambios de ocupación de mesas.
3. **Operación del administrador (`ADM-02`, `ADM-05`, `ADM-09`):** Suscripción a nuevos pedidos entrantes (`orders`), nuevas reservas (`reservations`) y solicitudes de cierre de cuenta de mesa (`table_accounts`).

### Estrategia ante reconexión o pérdida de red
- Si el canal Realtime se desconecta, el frontend muestra un indicador discreto y ejecuta una re-consulta HTTP (`refetch`) al reconectar o al recuperar el foco de la ventana (`visibilitychange`), evitando datos obsoletos.

---

## 3. Semilla inicial y migración de catálogo existente

Al preparar la base de datos en fases posteriores:
- Se migrarán las **4 categorías iniciales** (`Hamburguesas`, `Perros`, `Salchipapas`, `Antojos`) y los **13 productos base** de `js/app.js` (`L9-L23`) preservando sus descripciones completas, precios y etiquetas (corrigiendo la pérdida de `desc` y `tag` que hoy ocurre en `js/admin.js`).
- Las fotografías locales optimizadas a WebP se cargarán al bucket `product-images` de Supabase Storage.
- No se migrarán pedidos ficticios ni usuarios de prueba desde `localStorage` a producción.
