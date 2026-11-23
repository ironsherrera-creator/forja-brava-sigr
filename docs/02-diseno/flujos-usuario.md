# Flujos de Usuario y Recorridos Operativos
## FORJA BRAVA — SIGR

Este documento visualiza mediante diagramas Mermaid y secuencias concretas los recorridos de usuario de las cuatro experiencias, asegurando coherencia entre diseño UI/UX, reglas de negocio y seguridad.

---

## 1. Flujo de Autenticación y Redirección por Rol (D-06)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant UI as Frontend React (/login)
    participant Auth as Supabase Auth
    participant DB as PostgreSQL (profiles + RLS)

    U->>UI: Ingresa correo y contraseña
    UI->>Auth: signInWithPassword()
    Auth-->>UI: Sesión JWT (access_token)
    UI->>DB: Consulta perfil propio (id = auth.uid())
    DB-->>UI: { role, is_active, full_name }
    alt Cuenta inactiva
        UI->>Auth: signOut()
        UI-->>U: Muestra error "Tu cuenta está desactivada"
    else Cuenta activa
        UI-->>U: Redirige a ?redirect (si cliente) o /cliente | /mesero | /admin
    end
```

---

## 2. Flujo de Compra Online: Domicilio, Recoger y Mesa (`CLI-05`)

```mermaid
flowchart TD
    A[Menú / Detalle Producto] --> B[Agregar al Carrito localStorage]
    B --> C[Pulsar IR AL CHECKOUT]
    C --> D{¿Usuario autenticado? D-06}
    D -- No --> E[Redirige a /login?redirect=/checkout]
    E --> F[Autenticación exitosa -> Retoma carrito]
    D -- Sí --> F
    F --> P1[Paso 1: Revisar ítems, complementos y notas]
    P1 --> P2[Paso 2: Elegir Modalidad]
    P2 -->|Domicilio| P3A[Paso 3: Dirección + Tarifa fija D-03]
    P2 -->|Recoger| P3B[Paso 3: Datos cliente + Hora estimada]
    P2 -->|En mesa| P3C[Paso 3: Mesa libre o Reserva activa]
    P3A --> P4[Paso 4: Pago simulado Efectivo/Tarjeta/Nequi/PSE]
    P3B --> P4
    P3C --> P4M[Paso 4: Aviso Pago Pendiente hasta cierre D-04]
    P4 --> RPC[RPC create_order en servidor: valida precios y stock]
    P4M --> RPC
    RPC --> P5[Paso 5: Comprobante imprimible + Limpieza carrito + Link Seguimiento]
```

---

## 3. Flujo de Reserva Pública con Confirmación Automática (D-01, D-02, D-06)

```mermaid
flowchart TD
    A[Visitante entra a /reservas] --> B[Selecciona Fecha + Personas + Zona opcional]
    B --> C[RPC get_available_slots: consulta mesas D-01, horarios y duración D-02]
    C --> D{¿Hay franjas disponibles?}
    D -- No --> E[Muestra estado vacío y sugiere otra fecha/horario]
    D -- Sí --> F[Usuario elige franja horaria y escribe observaciones]
    F --> G{¿Usuario autenticado? D-06}
    G -- No --> H[Redirige a /login?redirect=/reservas conservando datos]
    G -- Sí --> I[RPC create_reservation: revalida solapamiento atómicamente]
    H --> I
    I -->|Éxito| J[Asigna mesa compatible + Estado Confirmada + Código RS-...]
    I -->|Conflicto simultáneo| K[Informa y refresca franjas libres]
```

---

## 4. Flujo Operativo del Mesero y Cierre de Cuenta en Caja (D-04, D-05)

```mermaid
sequenceDiagram
    actor M as Mesero
    actor A as Administrador (Preparación y Caja)
    participant DB as Supabase PostgreSQL

    M->>DB: Selecciona Mesa #X -> Registra comanda (RPC create_table_order)
    DB-->>M: Mesa pasa a Ocupada; Pedido = Pendiente; Pago = Pendiente (D-04)
    Note over M: Si el pedido sigue en Pendiente, puede Cancelar (D-05)
    A->>DB: Actualiza preparación: Pendiente -> Confirmado -> En preparación -> Listo
    DB-->>M: Alerta Realtime: Pedido de Mesa #X Listo
    M->>DB: Marca pedido como Entregado (D-05)
    Note over M: Puede repetir comandas sobre la misma cuenta de mesa
    M->>DB: Solicita Cierre de Cuenta de Mesa #X (MES-05)
    A->>DB: En Caja (ADM-09) cobra cuenta consolidada (Efectivo/Digital simulado)
    DB-->>A: Registra pago único, vincula a turno de caja y libera Mesa #X -> Disponible
```

---

## 5. Ciclo de Estados y Trazabilidad de Pedidos

```mermaid
stateDiagram-v2
    [*] --> Pendiente : Creación (Cliente o Mesero)
    Pendiente --> Cancelado : Mesero (D-05) o Admin
    Pendiente --> Confirmado : Admin
    Confirmado --> En_preparacion : Admin
    Confirmado --> Cancelado : Admin
    En_preparacion --> Listo : Admin
    En_preparacion --> Cancelado : Admin
    Listo --> Despachado : Admin (Solo Domicilio)
    Listo --> Entregado : Admin (Recoger/Mesa) o Mesero (Mesa D-05)
    Despachado --> Entregado : Admin (Domicilio)
    Entregado --> [*]
    Cancelado --> [*]
```
