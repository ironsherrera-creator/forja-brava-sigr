/**
 * Script local de provisión controlada de cuentas de prueba — FORJA BRAVA SIGR.
 *
 * SEGURIDAD:
 * - Solo se ejecuta desde terminal local por un operador autorizado.
 * - NUNCA se importa en el frontend ni expone `service_role` al navegador.
 * - NUNCA imprime contraseñas ni `SUPABASE_SERVICE_ROLE_KEY` en stdout/stderr.
 * - Solo opera sobre la allowlist exacta de 3 correos de prueba
 *   (`admin@forjabrava.com`, `mesero@forjabrava.com`, `cliente@forjabrava.com`)
 *   para impedir modificaciones accidentales sobre otros usuarios.
 *
 * Uso:
 *   $env:SUPABASE_URL = "https://<proyecto>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
 *   node scripts/setup-test-accounts.mjs [--dry-run] [--reset]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_TEST_EMAILS = new Set([
  'admin@forjabrava.com',
  'mesero@forjabrava.com',
  'cliente@forjabrava.com',
]);
const VALID_ROLES = new Set(['cliente', 'mesero', 'administrador']);
const CREDENTIALS_FILE = path.resolve(process.cwd(), '.tmp', 'test-accounts.local.json');

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const isReset = args.has('--reset');

function loadLocalAccounts() {
  if (!existsSync(CREDENTIALS_FILE)) {
    throw new Error(
      'No se encontró .tmp/test-accounts.local.json. Genera primero el archivo local ignorado por Git.',
    );
  }
  const parsed = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
  const accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  if (accounts.length === 0) {
    throw new Error('El archivo local de cuentas de prueba no contiene registros válidos.');
  }

  for (const acc of accounts) {
    const emailLower = typeof acc.email === 'string' ? acc.email.trim().toLowerCase() : '';
    if (!ALLOWED_TEST_EMAILS.has(emailLower)) {
      throw new Error(`Correo fuera de la allowlist de cuentas de prueba: ${acc.email}`);
    }
    if (!VALID_ROLES.has(acc.role)) {
      throw new Error(`Rol no permitido: ${acc.role}`);
    }
    if (typeof acc.password !== 'string' || acc.password.length < 12) {
      throw new Error(`La contraseña local para ${acc.email} no cumple longitud mínima segura.`);
    }
  }

  return accounts;
}

async function main() {
  const accounts = loadLocalAccounts();

  if (isDryRun) {
    console.log('[DRY-RUN] Cuentas de prueba listas para provisión (sin escribir en Supabase):');
    for (const acc of accounts) {
      console.log(` - ${acc.email} -> rol: ${acc.role} (${isReset ? 'crear/restablecer' : 'crear/sincronizar'})`);
    }
    return;
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY únicamente en tu terminal local antes de ejecutar este script (sin --dry-run).',
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Obtener catálogo real de roles desde public.roles
  const { data: rolesRows, error: rolesErr } = await adminClient
    .from('roles')
    .select('id, code');
  if (rolesErr) {
    throw new Error(`No fue posible leer public.roles: ${rolesErr.message}`);
  }
  const roleIdByCode = new Map((rolesRows ?? []).map((r) => [r.code, r.id]));

  // 2. Listar usuarios existentes en Auth para operar idempotentemente
  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    throw new Error(`No fue posible listar usuarios en Auth: ${listErr.message}`);
  }
  const existingByEmail = new Map(
    (listData?.users ?? []).map((u) => [String(u.email || '').toLowerCase(), u]),
  );

  for (const acc of accounts) {
    const emailLower = acc.email.toLowerCase();
    const roleId = roleIdByCode.get(acc.role);
    if (!roleId) {
      throw new Error(`El rol '${acc.role}' no existe en public.roles.`);
    }

    let userId = existingByEmail.get(emailLower)?.id || null;

    if (!userId) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.fullName, phone: acc.phone || '' },
      });
      if (createErr || !created?.user?.id) {
        throw new Error(`No fue posible crear ${acc.email}: ${createErr?.message || 'Error desconocido'}`);
      }
      userId = created.user.id;
      console.log(`[CREADO] ${acc.email}`);
    } else if (isReset) {
      const { error: updAuthErr } = await adminClient.auth.admin.updateUserById(userId, {
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.fullName, phone: acc.phone || '' },
      });
      if (updAuthErr) {
        throw new Error(`No fue posible restablecer ${acc.email}: ${updAuthErr.message}`);
      }
      console.log(`[RESTABLECIDO] ${acc.email}`);
    } else {
      console.log(`[EXISTENTE] ${acc.email} (sincronizando perfil y rol)`);
    }

    // 3. Asignar rol exacto y estado activo en public.profiles (sin tocar usuarios reales)
    const { error: profErr } = await adminClient
      .from('profiles')
      .update({
        role_id: roleId,
        full_name: acc.fullName,
        phone: acc.phone || null,
        is_active: true,
      })
      .eq('id', userId);

    if (profErr) {
      throw new Error(`No fue posible actualizar perfil de ${acc.email}: ${profErr.message}`);
    }
  }

  // 4. Verificación final
  const { data: verified, error: verErr } = await adminClient
    .from('profiles')
    .select('email, full_name, is_active, roles ( code )')
    .in(
      'email',
      accounts.map((a) => a.email),
    );
  if (verErr) {
    throw new Error(`No fue posible verificar perfiles finales: ${verErr.message}`);
  }

  console.log('\nVerificación final de perfiles de prueba:');
  for (const row of verified ?? []) {
    const roleCode = Array.isArray(row.roles) ? row.roles[0]?.code : row.roles?.code;
    console.log(` - ${row.email} | rol=${roleCode} | active=${row.is_active}`);
  }
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
