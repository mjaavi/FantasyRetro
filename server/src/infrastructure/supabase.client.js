"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabase = void 0;
exports.supabaseAsUser = supabaseAsUser;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY son obligatorias. ' +
        'SUPABASE_KEY sigue aceptandose solo como fallback temporal.');
}
// Cliente anon — para operaciones de lectura pública y verificación de auth
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
// CAMBIO: eliminado el fragmento de la key del log — nunca loggear
// partes de credenciales, aunque sean parciales.
console.log('[Supabase] Service role key:', supabaseServiceKey ? 'cargada ✓' : 'NO encontrada — usando anon key como fallback');
/**
 * Cliente con service_role — bypasa RLS para operaciones del servidor
 * que necesitan leer datos de cualquier usuario (ej: calcular ranking).
 * NUNCA exponer esta key en el cliente.
 * Si no está configurada, usa el cliente anon como fallback.
 */
exports.supabaseAdmin = supabaseServiceKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    : exports.supabase;
/**
 * Crea un cliente autenticado con el JWT del usuario.
 * Necesario para operaciones de escritura sujetas a RLS.
 */
function supabaseAsUser(userToken) {
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
}
