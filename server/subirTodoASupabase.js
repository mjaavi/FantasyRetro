const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 1. Credenciales
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en server/.env');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 2. Definicion de tareas (Carpeta local -> Bucket en Supabase)
const tareas = [
    {
        local: path.join(__dirname, '..', 'client', 'public', 'players_webp'),
        bucket: 'players'
    },
    {
        local: path.join(__dirname, '..', 'client', 'public', 'clubs_webp'),
        bucket: 'clubs'
    }
];

async function ejecutarSubida() {
    for (const tarea of tareas) {
        if (!fs.existsSync(tarea.local)) {
            console.log(`La carpeta ${tarea.local} no existe. Saltando...`);
            continue;
        }

        const archivos = fs.readdirSync(tarea.local);
        console.log(`\nSubiendo ${archivos.length} archivos al bucket "${tarea.bucket}"...`);

        for (const archivo of archivos) {
            const rutaArchivo = path.join(tarea.local, archivo);
            const fileBuffer = fs.readFileSync(rutaArchivo);

            const { error } = await supabase.storage
                .from(tarea.bucket)
                .upload(archivo, fileBuffer, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (error) {
                console.error(`Error en ${archivo}:`, error.message);
            } else {
                console.log(`[${tarea.bucket}] Subido: ${archivo}`);
            }
        }
    }
    console.log('\nProceso completado. Todos los cromos y escudos estan en la nube.');
}

ejecutarSubida();
