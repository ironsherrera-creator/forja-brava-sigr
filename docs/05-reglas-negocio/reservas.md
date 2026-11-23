# Reglas de Negocio — Reservas
## FORJA BRAVA — SIGR

---

## 1. Requisitos obligatorios
- **Autenticación (D-06):** Solo un usuario autenticado puede confirmar una reserva pública (`PUB-05`); los visitantes pueden consultar disponibilidad antes de iniciar sesión.
- **Inventario dinámico (D-01):** Las reservas se asignan únicamente sobre mesas activas (`is_active = true` y `status <> 'fuera_de_servicio'`) configuradas en `ADM-07`.
- **Duración configurable (D-02):** Cada turno tiene una duración `D` en minutos tomada de `restaurant_settings.reservation_duration_minutes`. El bloque ocupado es `[start_at, start_at + D)`.

---

## 2. Algoritmo de disponibilidad y confirmación automática
1. Validar que `reservation_date >= hoy (America/Bogota)` y `party_size >= 1`.
2. Obtener la ventana de apertura y cierre del día seleccionado desde `restaurant_settings.business_hours`.
3. Generar candidatos de horario inicio (ej. cada 30 minutos) tales que `start_at + D <= hora_cierre` y (si es hoy) `start_at > hora_actual`.
4. Filtrar mesas activas donde `capacity >= party_size` (y `zone = preferencia` si el cliente eligió zona).
5. Para cada horario candidato, excluir mesas que tengan una reserva con `status IN ('Pendiente','Confirmada')` cuyo intervalo `[r.start_at, r.end_at)` se solape con `[start_at, start_at + D)`.
6. Un horario aparece como disponible si existe **al menos 1 mesa libre compatible**.
7. **Asignación automática de mesa:** Al confirmar, el sistema elige la mesa libre de **menor capacidad suficiente** (`ORDER BY capacity ASC`) para optimizar el aforo del restaurante, valida la restricción de exclusión en PostgreSQL y crea la reserva automáticamente en estado **`Confirmada`** con código único `RS-YYYYMMDD-XXXX`.

---

## 3. Estados y cancelaciones
- **Estados:** `Pendiente`, `Confirmada` (estado inicial en reserva automática), `Atendida` (cuando el cliente llega y se sienta), `Cancelada`.
- **Cancelación por cliente (`CLI-08`):** Permitida mientras la reserva esté en `Pendiente` o `Confirmada` y falten al menos `reservation_cancel_cutoff_minutes` (propuesta P-02: 60 min) antes de `start_at`.
- **Cancelación por administrador (`ADM-06`):** Permitida en cualquier momento previo a `Atendida`.
- **Efecto inmediato:** Al pasar a `Cancelada`, la restricción parcial de exclusión deja de aplicar y la mesa vuelve a estar disponible en ese intervalo de forma inmediata.
