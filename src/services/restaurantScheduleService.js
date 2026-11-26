import { getSupabaseClient } from '../lib/supabase';
import { extractFieldErrors } from '../schemas/authSchemas';
import { restaurantScheduleConfigSchema } from '../schemas/adminSchemas';

export async function updateRestaurantScheduleConfig(input, updatedBy = null) {
  const parsed = restaurantScheduleConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los horarios y parámetros ingresados.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  // Validar que en los días abiertos la hora de cierre sea posterior a la de apertura
  for (const [day, cfg] of Object.entries(parsed.data.business_hours)) {
    if (!cfg.closed && cfg.open >= cfg.close) {
      return {
        data: null,
        error: {
          code: 'INVALID_HOURS_RANGE',
          message: `En el día "${day}", la hora de cierre debe ser posterior a la hora de apertura.`,
        },
      };
    }
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurant_settings')
      .update({
        restaurant_name: parsed.data.restaurant_name,
        location: parsed.data.location,
        phone: parsed.data.phone,
        fixed_delivery_fee: parsed.data.fixed_delivery_fee,
        reservation_duration_minutes: parsed.data.reservation_duration_minutes,
        reservation_cancel_cutoff_minutes: parsed.data.reservation_cancel_cutoff_minutes,
        allow_client_table_orders: parsed.data.allow_client_table_orders,
        business_hours: parsed.data.business_hours,
        is_provisional_config: false,
        updated_by: updatedBy,
      })
      .eq('id', 1)
      .select('*')
      .single();

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'SETTINGS_UPDATE_ERROR',
          message: 'No fue posible guardar la configuración del restaurante.',
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'SETTINGS_UPDATE_EXCEPTION',
        message: 'Error de conexión al guardar la configuración.',
      },
    };
  }
}
