# Corrección del módulo de mesas del mesero
## FORJA BRAVA — SIGR

**Fecha:** 25 de noviembre de 2026 (`America/Bogota`)  
**Proyecto Supabase:** `pyyfcqphmiusnqlrslgu`  
**Dictamen:** **`PENDIENTE DE CONFIGURACIÓN ADMINISTRATIVA`** (la corrección de código está completa y probada; faltan las mesas, que deben registrarse desde `/admin/mesas`).

---

## 1. Causa raíz

`public.restaurant_tables` tiene **0 registros** en producción. No era un fallo de RLS, de permisos ni de la consulta.

| Hipótesis evaluada | Resultado |
| :--- | :---: |
| Tabla sin registros | **CAUSA RAÍZ** (`tables_total = 0`) |
| Registros inactivos | Descartada (no hay registros) |
| RLS impide la lectura | Descartada |
| Permisos insuficientes | Descartada |
| Consulta incorrecta en `waiterService` | Descartada |
| Filtros incorrectos | Descartada |
| Realtime | Descartada (lectura base correcta; ver §4) |
| Mapeo de datos | Descartada |

**Factor agravante en el frontend:** con 0 mesas, `WaiterTablesPage` mostraba «Sin mesas en este estado / Cambia el filtro…», un mensaje engañoso que sugería un problema de filtros en lugar de falta de configuración. `WaiterNewOrderPage` tampoco explicaba por qué el selector de mesa estaba vacío.

## 2. Datos reales encontrados (solo lectura)

- `restaurant_tables`: **0** (activas: 0, inactivas: 0, por estado: ninguna).
- `table_accounts` abiertas o en cierre: **0**. `orders`: **0**.
- Política `restaurant_tables_select_roles`: `is_admin() OR is_waiter() OR (reserva propia)`. Escritura (`INSERT`/`UPDATE`/`DELETE`): solo `is_admin()`.

## 3. Prueba con el usuario real `mesero@forjabrava.com` (Supabase remoto)

Con sesión real (`signInWithPassword`), sin crear datos:

| Operación | Resultado |
| :--- | :--- |
| `SELECT restaurant_tables` | Sin error, `0` filas (RLS permite leer; no hay datos) |
| `SELECT table_accounts` abiertas | Sin error, `0` filas |
| `SELECT orders` de mesa | Sin error, `0` filas |
| `get_salon_staff_directory()` | OK (`2` registros) |
| `INSERT` directo en `restaurant_tables` | **Bloqueado** |
| RPC `admin_save_restaurant_table` | **Bloqueada** (`FORBIDDEN_ROLE`) |

## 4. Correcciones realizadas

- [WaiterTablesPage.jsx](file:///c:/Users/Sebastian/Documents/Urestaurante/src/pages/waiter/WaiterTablesPage.jsx): nuevo estado vacío «Aún no hay mesas configuradas» que indica que el administrador debe registrarlas en `/admin/mesas`; se mantiene «Sin mesas en este estado» solo cuando el filtro no coincide. Los errores de consulta siguen mostrándose como error, nunca como lista vacía ni falsa disponibilidad.
- [WaiterNewOrderPage.jsx](file:///c:/Users/Sebastian/Documents/Urestaurante/src/pages/waiter/WaiterNewOrderPage.jsx): aviso explícito cuando no hay mesas configuradas o ninguna activa disponible.
- **Sin cambios en RLS, permisos ni migraciones**: no eran necesarios y no se tocó la base remota.
- Realtime: `useWaiterSalon` ya suscribe `restaurant_tables`, `table_accounts` y `orders` (con *polling* de 25 s y botón «Actualizar»); las mesas nuevas aparecen sin recargar la página (probado en E2E con «Actualizar»).

## 5. Integración con administración (D-01)

El administrador crea, edita (código, zona, capacidad) y activa/desactiva mesas desde `/admin/mesas` mediante la RPC `admin_save_restaurant_table` (probada en PostgreSQL). **No se crearon mesas en producción**, para no inventar cantidades ni registros.

**Procedimiento pendiente (acción del administrador):** iniciar sesión como `admin@forjabrava.com`, abrir `/admin/mesas`, registrar el número real de mesas del restaurante (código, zona y capacidad) y dejarlas activas. El mesero las verá de inmediato en `/mesero/mesas`. La cantidad exacta la define el restaurante y no consta en el repositorio.

## 6. Archivos modificados / creados

- Modificados: `src/pages/waiter/WaiterTablesPage.jsx`, `src/pages/waiter/WaiterNewOrderPage.jsx`.
- Pruebas nuevas: `tests/unit/waiterTablesStates.test.jsx`, `tests/sql/waiterTablesAccess.test.js`, `tests/e2e/waiter-tables.spec.js`.
- Informe: este documento.

## 7. Pruebas ejecutadas

| Verificación | Resultado |
| :--- | :--- |
| `npm run lint` | `EXIT 0`, 0 errores/advertencias |
| `npm test` | **19/19 suites, 92/92 pruebas** |
| `npm run build` | `EXIT 0` |
| `npm run test:e2e` | **27/27** |

Cobertura nueva:
- **Unitarias:** estado vacío sin mesas (sin falsa disponibilidad), mesas disponibles/ocupadas/inactivas, error de permisos como error.
- **SQL (PostgreSQL real):** el mesero ve mesas activas e inactivas con su estado; el cliente sin reservas no ve ninguna; el mesero no puede crear, modificar ni eliminar mesas ni usar RPC administrativas; el administrador edita código y capacidad y activa/desactiva; comanda sobre mesa inactiva rechazada (`TABLE_UNAVAILABLE`); comanda sobre mesa activa acumula cuenta y mesa pasa a `ocupada`; el mesero solicita cierre (`closing_requested`).
- **E2E:** aviso sin mesas, aparición de mesas tras «Actualizar», error de permisos mostrado como error.

## 8. Limitaciones y observaciones

- Los flujos «mesero selecciona mesa → crea comanda → consulta cuenta → solicita cierre» se probaron en PostgreSQL real local (PGlite), no contra producción, porque no hay mesas y no se autorizó crear registros ni transacciones en remoto.
- La suscripción Realtime en navegador contra Supabase real no se probó en vivo; su verificación en E2E se hizo mediante actualización manual con datos simulados.

## 9. Dictamen

**`PENDIENTE DE CONFIGURACIÓN ADMINISTRATIVA`**

El mesero real puede leer mesas sin errores de permisos y no puede administrarlas. El único bloqueo operativo es que no existen mesas registradas; en cuanto el administrador las cree desde `/admin/mesas`, estarán disponibles para el mesero. Tras hacerlo, conviene repetir la prueba con `mesero@forjabrava.com` para pasar el dictamen a **CORREGIDO**.
