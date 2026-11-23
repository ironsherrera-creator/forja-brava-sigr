# Alcance Funcional y Decisiones Aprobadas
## FORJA BRAVA — SIGR

Este documento delimita el alcance funcional completo de la primera versión productiva de **FORJA BRAVA — SIGR**, separando explícitamente las **decisiones definitivas aprobadas** de los **supuestos y propuestas técnicas** pendientes de confirmación.

---

## 1. Decisiones funcionales definitivas (Aprobadas)

Las siguientes decisiones son inmutables para el diseño, el modelo de datos y la implementación:

| Código | Decisión aprobada | Regla operativa obligatoria |
|---|---|---|
| **D-01** | **Inventario de mesas configurable desde administración** | No existe un número fijo de mesas. El administrador crea, edita y desactiva mesas definiendo identificador/número, zona, capacidad, estado y disponibilidad. |
| **D-02** | **Duración de reservas configurable desde administración** | El administrador configura la duración estándar del turno (minutos). El sistema calcula bloques disponibles y bloquea solapamientos en una misma mesa. |
| **D-03** | **Tarifa fija de domicilio** | Se aplica una tarifa fija configurable desde administración. **El importe monetario concreto no se inventa**; se gestiona como parámetro editable. |
| **D-04** | **Pago de pedidos en mesa al cerrar la cuenta** | Varios pedidos de una misma mesa se acumulan en una **cuenta de mesa**. El pago queda `Pendiente` al crear cada comanda y se cobra/registra al cerrar la cuenta. |
| **D-05** | **Permisos específicos del mesero** | El mesero puede registrar pedidos en mesa, consultar los pedidos de sus mesas, marcar pedidos como `Entregado` y cancelar pedidos **recién registrados** (`Pendiente`, antes de preparación). No gestiona estados de preparación, precios, productos, usuarios, caja ni reportes financieros. |
| **D-06** | **Autenticación obligatoria para pedidos y reservas** | El cliente debe iniciar sesión para confirmar pedidos (checkout) o crear reservas. La navegación del sitio público y del menú digital permanece abierta sin autenticación. |

### Reglas adicionales aprobadas
- **Modalidades de pedido:** `Domicilio`, `Recoger` y `En mesa`.
- **Roles oficiales:** `cliente`, `mesero` y `administrador`.
- **Responsable de preparación:** El **administrador** gestiona los estados de preparación de los pedidos.
- **Sin panel de cocina independiente:** En esta primera versión no se desarrollará una pantalla separada de cocina (KDS); el administrador concentra la gestión de preparación.
- **Pagos simulados:** Todos los medios (`Efectivo`, `Tarjeta`, `Nequi`, `PSE`) operan como simulación controlada, identificándose siempre de forma explícita como pago simulado sin transacción bancaria real.

---

## 2. Alcance funcional por experiencia

### 2.1. Sitio público (Acceso libre)
- Landing page comercial (`Hero`, `Cinta`, `Nuestra esencia`, `Carta`, `Producto protagonista`, `Experiencia`, `Contacto`, `Footer`).
- Menú digital con categorías dinámicas, buscador, filtros y tarjetas de producto.
- Modal/drawer de detalle de producto con complementos explícitos, cantidad y observaciones.
- Carrito lateral persistente en `localStorage` con compuerta de inicio de sesión al pasar a checkout (D-06).
- Pantalla pública de reservas con consulta de disponibilidad en vivo (requiere login para confirmar, D-06).
- Contacto con canales reales desde configuración.
- Acceso a Login y Registro.

### 2.2. Experiencia del cliente (Rol: `cliente`)
- Registro, inicio de sesión y recuperación de contraseña.
- Dashboard personal con indicadores propios (pedidos activos, último pedido, próximas reservas, historial).
- Gestión de perfil y libreta de direcciones de entrega.
- Checkout de 5 pasos para `Domicilio`, `Recoger` y `En mesa`, con pagos simulados y comprobante imprimible.
- Listado e historial de pedidos (`Todos`, `Activos`, `Completados`, `Cancelados`) y seguimiento paso a paso según modalidad.
- Listado, detalle y cancelación permitida de reservas propias.

### 2.3. Experiencia del mesero (Rol: `mesero`)
- Inicio de sesión y dashboard operativo enfocado en salón.
- Visualización y disponibilidad del inventario de mesas (D-01) por zona y estado.
- Toma de comanda en mesa reutilizando catálogo, filtros, buscador, complementos, cantidades y observaciones.
- Consulta de pedidos registrados de mesas, entrega autorizada (`Entregado`) y cancelación restringida a `Pendiente` (D-05).
- Consulta de cuenta acumulada por mesa y solicitud de cierre de cuenta (D-04).

### 2.4. Experiencia del administrador (Rol: `administrador`)
- Dashboard KPI diario (zona horaria `America/Bogota`) y actividad reciente.
- CRUD completo de productos (con imagen en Storage, descripción, etiqueta y complementos) y categorías.
- Gestión integral de pedidos de las 3 modalidades y control de estados de preparación.
- Gestión de reservas, ocupación diaria y calendario mensual con validación de disponibilidad (D-02).
- Gestión de inventario de mesas (D-01).
- Gestión de usuarios y asignación protegida de roles (`cliente`, `mesero`, `administrador`).
- Caja completa: apertura con base inicial, cobro de cuentas de mesa cerradas (D-04), ingresos/egresos, arqueo y cierre sin duplicar ventas.
- Reportes diarios y por periodo (ventas, productos por ID, modalidades, pagos, reservas y caja) imprimibles.
- Configuración centralizada del restaurante y auditoría inmutable de actividad crítica.

---

## 3. Supuestos y decisiones menores pendientes (No aprobadas aún)

| ID | Tema pendiente | Recomendación técnica (propuesta) |
|---|---|---|
| **P-01** | Monto numérico inicial de la tarifa fija de domicilio (D-03). | Inicializar en configuración como parámetro editable (ej. valor por defecto `0` con alerta al administrador hasta definir monto comercial). |
| **P-02** | Ventana mínima de anticipación para que un cliente cancele su reserva. | Configurar parámetro `reservation_cancel_cutoff_minutes` en Configuración (propuesta inicial: `60` minutos antes del turno). |
| **P-03** | Destino operativo del formulario de contacto público (`PUB-06`). | Guardar mensajes en tabla `contact_messages` consultable en admin o sustituirlo por botón directo a WhatsApp configurado. |
| **P-04** | Quién registra el cobro final de una cuenta de mesa (D-04). | Mantener separación estricta: el **mesero** solicita el cierre de cuenta y el **administrador en Caja** registra el pago definitivo y cierra la cuenta para garantizar control financiero. |
| **P-05** | Alcance de pedidos `En mesa` realizados por el propio cliente desde el móvil. | Permitir que el cliente seleccione una mesa libre o su reserva confirmada; las comandas de mesa quedan siempre con pago `Pendiente` hasta cierre de cuenta. |
