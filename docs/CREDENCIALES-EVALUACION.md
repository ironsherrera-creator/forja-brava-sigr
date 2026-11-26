# Guía de Acceso y Credenciales de Evaluación Académica
## FORJA BRAVA — SIGR (*El sabor que se hace a fuego.*)

Este documento facilita el acceso y la evaluación académica de **FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)** en su entorno de producción. El sistema cuenta con tres perfiles independientes (`Cliente`, `Mesero` y `Administrador`), cada uno con vistas y permisos diferenciados.

---

## Ingresar a la aplicación

- **Enlace oficial de producción:** https://forja-brava-sigr.vercel.app/
- **Plataforma de despliegue:** Vercel (entorno de producción disponible para evaluación académica).
- **Repositorio oficial:** https://github.com/ironsherrera-creator/forja-brava-sigr

---

## Credenciales de evaluación

| Rol | Nombre del perfil | Correo electrónico | Contraseña |
| :--- | :--- | :--- | :--- |
| **Cliente** | Valentina Gómez (Prueba) | `cliente@forjabrava.com` | Entregada al profesor por canal privado |
| **Mesero** | Mateo Ríos (Prueba) | `mesero@forjabrava.com` | Entregada al profesor por canal privado |
| **Administrador** | Camila Herrera (Prueba) | `admin@forjabrava.com` | Entregada al profesor por canal privado |

> **Nota de seguridad:** Este repositorio de GitHub es público. Por buenas prácticas de seguridad, ninguna contraseña real, clave de Supabase ni credencial privada se almacena en este documento; las contraseñas de evaluación se entregan al profesor exclusivamente por un canal privado.

---

## Funcionalidades para evaluar

### Cliente
- Consultar el catálogo y las categorías disponibles.
- Consultar el detalle de productos y sus complementos.
- Gestionar reservas y demás funcionalidades habilitadas para clientes (perfil, direcciones, pedidos, seguimiento e historial).

### Mesero
- Consultar el mapa y estado de las mesas.
- Registrar pedidos y comandas en mesa.
- Consultar cuentas activas acumuladas por mesa.
- Gestionar las operaciones permitidas para su rol (entregas, cancelaciones permitidas y solicitud de cierre hacia caja).

### Administrador
- Gestionar productos y categorías del catálogo.
- Administrar usuarios, roles y permisos.
- Gestionar reservas y configuración de mesas.
- Consultar y administrar pedidos.
- Gestionar caja (apertura, movimientos, cobros, arqueos y cierres).
- Consultar reportes financieros/operativos y auditorías.

---

## Instrucciones de acceso

1. Ingresar al enlace oficial de producción: https://forja-brava-sigr.vercel.app/
2. Seleccionar el acceso mediante **Iniciar sesión** (`/login`).
3. Introducir el correo electrónico correspondiente al perfil que se desea evaluar.
4. Utilizar la contraseña entregada de manera privada para esa cuenta.
5. Explorar y evaluar las funcionalidades habilitadas para el rol autenticado.
6. **Cerrar sesión** desde el menú de usuario antes de probar otra cuenta con un perfil diferente.
