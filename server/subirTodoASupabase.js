const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Credenciales
const supabaseUrl = 'https://umnpkstcvgqnsipllmxd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbnBrc3RjdmdxbnNpcGxsbXhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5OTMwMSwiZXhwIjoyMDg2Mzc1MzAxfQ.KgvpcHjeQX7huH5l9chLYRWdL5VcuhDJPySPnWfdNJs'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Definición de tareas (Carpeta local -> Bucket en Supabase)
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
            console.log(`⚠️ La carpeta ${tarea.local} no existe. Saltando...`);
            continue;
        }

        const archivos = fs.readdirSync(tarea.local);
        console.log(`\n🚀 Subiendo ${archivos.length} archivos al bucket "${tarea.bucket}"...`);

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
                console.error(`❌ Error en ${archivo}:`, error.message);
            } else {
                console.log(`✅ [${tarea.bucket}] Subido: ${archivo}`);
            }
        }
    }
    console.log('\n✨ ¡Proceso completado! Todos los cromos y escudos están en la nube.');
}

ejecutarSubida();