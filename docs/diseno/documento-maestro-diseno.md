# FORJA BRAVA — SIGR
## Documento Maestro de Diseño Funcional y Visual (Versión Consolidada 2.1)

**Producto:** Sistema Integral de Gestión de Restaurante (SIGR)  
**Marca:** FORJA BRAVA — *El sabor que se hace a fuego.*  
**Versión:** 2.1 (Consolidada con TAREA 01, Auditoría Técnica Integral y Decisiones Oficiales D-01 a D-06)  
**Estado:** Especificación de diseño aprobada para revisión previa a arquitectura e implementación  
**Fuentes de verdad:**
1. Repositorio actual (`index.html`, `admin.html`, `css/`, `js/`, `assets/`).
2. Auditoría del diseño y funcionalidades existentes (TAREA 01).
3. Documento maestro de diseño funcional y visual versión 2.0 (`docs/auditorias/auditoria-diseno-funcional.md`).
4. Auditoría técnica integral QSTI (diagnóstico técnico de referencia).

---

## 1. Propósito y alcance

Este documento establece la especificación consolidada, funcional y visual de **FORJA BRAVA — SIGR**. Su objetivo es guiar la evolución progresiva del prototipo frontend existente hacia un sistema integral multi-rol sin descartar el diseño editorial, los componentes construidos ni la estructura operativa ya probada.

El sistema articula **cuatro experiencias conectadas** bajo una misma identidad visual:
1. **Sitio público:** Escaparate comercial, carta digital navegable sin autenticación, detalle de productos, información del restaurante y acceso a reservas/cuenta.
2. **Experiencia del cliente:** Autenticación obligatoria para operar, dashboard personal, perfil, checkout en cinco pasos (domicilio, recoger o mesa), pagos simulados, historial, seguimiento de estados y gestión de reservas.
3. **Experiencia del mesero:** Panel operativo táctil y ágil para consultar disponibilidad de mesas, registrar comandas multi-producto en mesa, consultar pedidos de sus mesas, marcar entregas, cancelar pedidos recién registrados y solicitar cierre de cuenta.
4. **Experiencia del administrador:** Panel de gestión integral con dashboard KPI, catálogo de productos, categorías, control de estados de preparación de pedidos, reservas con calendario y disponibilidad, inventario de mesas, usuarios y roles, caja con arqueo, reportes, auditoría y configuración global.

---

## 2. Principio de conservación del software existente

El código y diseño del repositorio actual constituyen la base obligatoria del producto. No se reconstruirán desde cero el sitio público ni el panel administrativo.

### Clasificación oficial de evolución

| Clasificación | Significado operativo |
|---|---|
| **CONSERVAR** | Elemento existente que funciona y responde a la identidad visual; se mantiene sin alterar su esencia. |
| **MEJORAR** | Elemento existente cuya base visual o lógica es válida, pero requiere completar campos, corregir defectos o conectar datos reales. |
| **REUTILIZAR** | Componente o patrón existente que se aprovecha en una nueva experiencia (ej. catálogo y carrito en el panel del mesero). |
| **CREAR** | Pantalla, módulo o interacción inexistente actualmente que debe diseñarse e integrarse con el sistema visual actual. |

### Inventario de conservación prioritaria
- **CONSERVAR:** Landing editorial (`index.html`), identidad cromática y tipográfica (`css/input.css`, `css/styles.css`), logotipo `FB`, estilo fotográfico cálido, tarjetas limpias, botones rectangulares, layout del panel administrativo (`admin.html`, `css/admin.css`), comprobante imprimible (`@media print`) y calendario mensual de reservas.
- **MEJORAR:** Menú digital (filtros y contadores dinámicos), producto destacado (`#destacado` conectado al catálogo), carrito (hidratación al cargar y sincronización), checkout (3 modalidades, autocompletado de cliente, tarifa fija, complementos explícitos), formulario de productos admin, tabla de pedidos admin, caja (apertura/movimientos/arqueo) y reportes (agrupación por ID y zona horaria local `America/Bogota`).
- **REUTILIZAR:** Tarjetas de producto y lógica de carrito (`js/app.js`) en el tomador de comandas del mesero; shell administrativo (`.admin-sidebar`, `.stats-grid`, `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.badge`, `.notice`) en las vistas de Mesero y Cliente.
- **CREAR:** Detalle de producto, reservas públicas con disponibilidad automática, dashboard del cliente (mis pedidos, seguimiento, mis reservas), panel operativo del mesero, y módulos administrativos de categorías, mesas, usuarios/roles, auditoría y configuración.

---

## 3. Decisiones funcionales aprobadas

Todas las pantallas y flujos de la documentación en `docs/diseno/` cumplen estrictamente las siguientes decisiones:

| Código | Tema | Decisión oficial aprobada | Impacto en diseño |
|---|---|---|---|
| **D-01** | Inventario de mesas | Configurable desde administración | Se crea módulo **Gestión de Mesas** (número, zona, capacidad, estado). No se fija un número estático de mesas. |
| **D-02** | Duración de reservas | Configurable desde administración | El administrador configura la duración del turno (en minutos) y los horarios; el motor calcula franjas disponibles y evita solapamientos. |
| **D-03** | Tarifa de domicilio | Tarifa fija | Se aplica una única tarifa fija configurable en **Configuración**. **No se establece ni inventa un importe monetario definitivo** en esta fase. |
| **D-04** | Pago en mesa | Se registra al cerrar la cuenta | Los pedidos en mesa se acumulan en la cuenta de la mesa con pago `Pendiente` y se cobran al ejecutar el cierre de cuenta, no al crear cada comanda. |
| **D-05** | Permisos del mesero | Puede marcar pedidos como `Entregado` y `Cancelado` si están recién registrados | El mesero no puede modificar estados de preparación (`Confirmado`, `En preparación`, `Listo`) ni cancelar pedidos que ya entraron a preparación. |
| **D-06** | Autenticación para operar | Obligatoria para pedidos y reservas | Cualquier visitante navega el sitio público y el menú sin sesión, pero al confirmar checkout o reservar debe iniciar sesión o registrarse. |

### Reglas transversales complementarias
1. **Tres modalidades de pedido:** `Domicilio`, `Recoger` y `En mesa`.
2. **Responsable de preparación:** El **administrador** gestiona las transiciones de preparación (`Pendiente` → `Confirmado` → `En preparación` → `Listo` → `Despachado` → `Entregado` / `Cancelado`).
3. **Pagos simulados:** Los medios `Efectivo`, `Tarjeta`, `Nequi` y `PSE` son simulaciones controladas sin pasarela bancaria real. El estado de pago (`Pendiente`, `Confirmación simulada`, `Fallido`, `Reembolsado`) es independiente del estado de preparación.
4. **Tres roles con separación estricta:** `cliente`, `mesero` y `administrador`. Ocultar controles en la interfaz no sustituye la autorización en servidor/base de datos.
5. **Zona horaria operativa:** Todos los cálculos de ventas del día, cierres de caja y disponibilidad de reservas deben evaluarse en la hora local del restaurante (`America/Bogota`, UTC-5), corrigiendo el desfase UTC detectado en `js/admin.js`.

---

## 4. Arquitectura de experiencias y mapa de navegación

```text
FORJA BRAVA — SIGR
├── 1. Sitio Público (Acceso libre)
│   ├── /                     Inicio (Landing comercial + Carta destacada)
│   ├── /menu                 Menú digital completo (o ancla #menu evolucionada)
│   ├── [Modal/Drawer]        Detalle de producto
│   ├── [Drawer]              Carrito lateral
│   ├── /reservas             Reservas públicas (requiere login al confirmar)
│   ├── /contacto             Sección de contacto y canales reales
│   ├── /login                Inicio de sesión unificado (redirige según rol)
│   └── /registro             Registro de cliente
│
├── 2. Experiencia Cliente (Rol: cliente)
│   ├── /cliente              Dashboard del cliente (resumen)
│   ├── /cliente/perfil       Mi perfil y direcciones de entrega
│   ├── /cliente/pedidos      Mis pedidos e historial
│   ├── /cliente/pedidos/:id  Seguimiento de pedido en línea temporal
│   ├── /cliente/reservas     Mis reservas y cancelaciones
│   └── /checkout             Checkout en 5 pasos (modal/vista dedicada)
│
├── 3. Experiencia Mesero (Rol: mesero)
│   ├── /mesero               Dashboard operativo del mesero
│   ├── /mesero/mesas         Mapa/grilla de mesas y disponibilidad
│   ├── /mesero/mesas/:id     Cuenta activa de mesa y cierre de cuenta
│   ├── /mesero/nuevo-pedido  Toma de comanda en mesa (reutiliza catálogo + carrito)
│   └── /mesero/pedidos       Pedidos registrados por mesa (entregar / cancelar)
│
└── 4. Experiencia Administrador (Rol: administrador)
    ├── /admin                Dashboard principal (KPIs + actividad)
    ├── /admin/productos      Gestión de productos
    ├── /admin/categorias     Gestión de categorías
    ├── /admin/pedidos        Gestión de pedidos y estados de preparación
    ├── /admin/reservas       Gestión de reservas y calendario
    ├── /admin/mesas          Gestión de inventario de mesas
    ├── /admin/usuarios       Gestión de usuarios y roles
    ├── /admin/caja           Apertura, movimientos, arqueo y cierre de caja
    ├── /admin/reportes       Reportes de ventas y operación
    ├── /admin/auditoria      Registro de auditoría del sistema
    └── /admin/configuracion  Parámetros globales del restaurante
```

---

## 5. Resumen de identidad visual oficial

El detalle completo se documenta en [`docs/diseno/identidad-visual.md`](./identidad-visual.md). Como norma obligatoria para las cuatro experiencias:
- **Colores oficiales:** Carbón `#171613`, Café `#35251d`, Madera `#68452f`, Crema `#f1e8d8`, Papel `#e9dfcf`, Arena `#d6c2a3`, Fuego `#c66a32`, Hover `#e07c42`.
- **Tipografías oficiales:** `Playfair Display` (títulos y acentos editoriales) y `DM Sans` (interfaz, formularios y tablas).
- **Cohesión:** Sitio público editorial/comercial; Cliente sencillo y orientado a compra; Mesero táctil y ágil; Administrador compacto y denso en datos. Todos comparten la misma marca, paleta, logotipo `FB` y lenguaje de componentes.

---

## 6. Índice de la documentación de diseño (`docs/diseno/`)

| Archivo | Contenido principal |
|---|---|
| [`documento-maestro-diseno.md`](./documento-maestro-diseno.md) | Visión consolidada, principio de conservación, decisiones D-01 a D-06 y mapa general. |
| [`inventario-pantallas.md`](./inventario-pantallas.md) | Catálogo completo de pantallas (existentes y nuevas), archivos, componentes reutilizables y acciones. |
| [`especificacion-sitio-publico.md`](./especificacion-sitio-publico.md) | Especificación detallada de los 14 puntos para cada pantalla del sitio público. |
| [`especificacion-cliente.md`](./especificacion-cliente.md) | Especificación detallada de registro, login, dashboard, perfil, checkout, pagos, seguimiento y reservas. |
| [`especificacion-mesero.md`](./especificacion-mesero.md) | Especificación detallada del panel operativo del mesero, mesas, comanda y cierre de cuenta. |
| [`especificacion-administrador.md`](./especificacion-administrador.md) | Especificación detallada de los 11 módulos del panel administrativo. |
| [`identidad-visual.md`](./identidad-visual.md) | Sistema visual oficial extraído del repositorio actual (tokens, componentes, responsive e impresión). |
| [`flujos-funcionales.md`](./flujos-funcionales.md) | Flujos paso a paso de extremo a extremo para todos los procesos de negocio y matrices de permisos. |

---

## 7. Criterios de aceptación global del diseño

El diseño de **FORJA BRAVA — SIGR** se considerará aprobado para pasar a la fase de arquitectura e implementación cuando:
1. Se confirme la conservación de la identidad visual y de los módulos funcionales existentes sin duplicidad.
2. Todas las pantallas de las cuatro experiencias cuenten con sus 14 elementos de especificación (objetivo, distribución, validaciones, estados, responsive, permisos y criterios).
3. Las decisiones D-01 a D-06 estén reflejadas de forma coherente en pantallas, flujos y permisos.
4. Se validen las decisiones operativas menores aún abiertas (ej. monto concreto de la tarifa fija de domicilio, ventana de cancelación de reservas por cliente y políticas de caja para cobro de cuentas de mesa).
5. Exista aprobación explícita antes de iniciar migración tecnológica, modelado SQL o cambios de código.
