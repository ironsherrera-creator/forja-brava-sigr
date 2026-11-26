import { describe, expect, it } from 'vitest';
import {
  restaurantScheduleConfigSchema,
  restaurantTableSchema,
} from '../../src/schemas/adminSchemas';
import {
  addressSchema,
  checkoutSchema,
  emailChangeSchema,
  reservationCreateSchema,
} from '../../src/schemas/clientSchemas';
import {
  buildOrderRpcPayload,
  mapOrderRpcError,
} from '../../src/services/orderService';
import { mapReservationError } from '../../src/services/reservationService';

describe('Etapas 6 y 7 — Esquemas Zod, payload transaccional e idempotencia', () => {
  it('valida direcciones del cliente y rechaza propiedades no permitidas (.strict())', () => {
    const ok = addressSchema.safeParse({
      label: 'Casa',
      address: 'Calle 85 # 15-40',
      neighborhood: 'Chapinero',
      directions: 'Apto 302',
      isDefault: true,
    });
    expect(ok.success).toBe(true);

    const injected = addressSchema.safeParse({
      label: 'Casa',
      address: 'Calle 85 # 15-40',
      neighborhood: 'Chapinero',
      user_id: 'otro-usuario',
    });
    expect(injected.success).toBe(false);
  });

  it('valida checkout por modalidad (domicilio exige dirección/barrio; recoger no; exige aceptar términos)', () => {
    const missingAddress = checkoutSchema.safeParse({
      modality: 'domicilio',
      paymentMethod: 'Efectivo',
      deliveryAddress: '',
      deliveryNeighborhood: '',
      acceptTerms: true,
    });
    expect(missingAddress.success).toBe(false);

    const pickupOk = checkoutSchema.safeParse({
      modality: 'recoger',
      paymentMethod: 'Nequi',
      simulatePaymentFailure: false,
      acceptTerms: true,
    });
    expect(pickupOk.success).toBe(true);

    const noTerms = checkoutSchema.safeParse({
      modality: 'recoger',
      paymentMethod: 'Efectivo',
      acceptTerms: false,
    });
    expect(noTerms.success).toBe(false);
  });

  it('construye payload RPC create_order sin enviar precios ni totales desde el navegador e incluye client_request_id', () => {
    const payload = buildOrderRpcPayload({
      modality: 'domicilio',
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 999999, // No debe enviarse al servidor
          addons: [{ id: 'addon-1', name: 'Queso', price: 1 }],
        },
      ],
      paymentMethod: 'Tarjeta',
      simulatePaymentFailure: false,
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      deliveryAddress: 'Cra 11 # 93-20',
      deliveryNeighborhood: 'Chicó',
    });

    expect(payload.p_client_request_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.p_items).toEqual([
      { product_id: 'prod-1', quantity: 2, addon_ids: ['addon-1'] },
    ]);
    expect(payload.p_items[0]).not.toHaveProperty('unitPrice');
    expect(payload).not.toHaveProperty('total');
  });

  it('traduce errores transaccionales de pedidos y reservas (incluyendo concurrencia y D-07)', () => {
    expect(mapOrderRpcError({ message: 'PAYMENT_SIMULATION_FAILED' })).toContain('rechazado');
    expect(mapOrderRpcError({ message: 'CLIENT_TABLE_ORDERS_DISABLED' })).toContain('mesero');
    expect(mapOrderRpcError({ message: 'CASH_CLOSED' })).toContain('caja');

    expect(mapReservationError({ message: 'excl_reservations_no_overlap' })).toContain(
      'otra reserva en ese mismo horario',
    );
    expect(mapReservationError({ message: 'INSUFFICIENT_CAPACITY' })).toContain('capacidad');
    expect(mapReservationError({ message: 'CANCEL_WINDOW_EXPIRED' })).toContain('plazo mínimo');
  });

  it('valida reservas, cambio de correo, mesas (capacidad >= 1) y horarios semanales', () => {
    expect(
      reservationCreateSchema.safeParse({
        date: '2026-12-20',
        time: '19:00',
        partySize: 4,
      }).success,
    ).toBe(true);
    expect(
      reservationCreateSchema.safeParse({
        date: '2026-12-20',
        time: '19:00',
        partySize: 0,
      }).success,
    ).toBe(false);

    expect(emailChangeSchema.safeParse({ email: 'nuevo@forjabrava.co' }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ email: 'invalido' }).success).toBe(false);

    expect(
      restaurantTableSchema.safeParse({
        code: 'M-01',
        zone: 'Salón',
        capacity: 4,
        isActive: true,
      }).success,
    ).toBe(true);
    expect(
      restaurantTableSchema.safeParse({
        code: 'M-01',
        zone: 'Salón',
        capacity: 0,
        isActive: true,
      }).success,
    ).toBe(false);

    const scheduleOk = restaurantScheduleConfigSchema.safeParse({
      restaurant_name: 'FORJA BRAVA',
      location: 'Bogotá, Colombia',
      phone: '+57 300 000 0000',
      fixed_delivery_fee: 6000,
      reservation_duration_minutes: 90,
      reservation_cancel_cutoff_minutes: 60,
      allow_client_table_orders: false,
      business_hours: {
        monday: { open: '12:00', close: '22:00', closed: false },
        tuesday: { open: '12:00', close: '22:00', closed: false },
        wednesday: { open: '12:00', close: '22:00', closed: false },
        thursday: { open: '12:00', close: '22:00', closed: false },
        friday: { open: '12:00', close: '23:00', closed: false },
        saturday: { open: '12:00', close: '23:00', closed: false },
        sunday: { open: '12:00', close: '22:00', closed: false },
      },
    });
    expect(scheduleOk.success).toBe(true);
  });
});
