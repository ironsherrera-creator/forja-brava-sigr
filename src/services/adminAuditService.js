import { getSupabaseClient } from '../lib/supabase';

/**
 * Consulta de solo lectura de la bitácora inmutable `audit_logs` (exclusivo administrador).
 */
export async function fetchAuditLogs({ entity = 'all', action = '' } = {}) {
  try {
    const client = getSupabaseClient();
    let query = client
      .from('audit_logs')
      .select('id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (entity && entity !== 'all') {
      query = query.eq('entity_name', entity);
    }
    if (action.trim()) {
      query = query.ilike('action', `%${action.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      return {
        data: [],
        error: { code: error.code, message: 'No fue posible consultar la bitácora de auditoría.' },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: { code: err.code, message: 'Error de conexión al consultar la auditoría.' },
    };
  }
}
