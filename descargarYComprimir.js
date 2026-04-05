const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const sharp = require('sharp');

// 1. Configuración de Rutas adaptadas a tu estructura Client/Server
const RUTA_CSV = path.join(__dirname, 'data', 'players_15.csv'); 

// Le decimos que suba una carpeta (..) y entre en client/public
const CARPETA_CARAS = path.join(__dirname, '..', 'client', 'public', 'players_webp');
const CARPETA_ESCUDOS = path.join(__dirname, '..', 'client', 'public', 'clubs_webp');

// Creamos las carpetas si no existen
[CARPETA_CARAS, CARPETA_ESCUDOS].forEach(carpeta => {
    if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
});

// 2. Nombres de las columnas exactas que me pasaste
const COL_ID_JUGADOR = 'sofifa_id';
const COL_URL_CARA = 'player_face_url';
const COL_ID_CLUB = 'club_team_id';
const COL_URL_ESCUDO = 'club_logo_url';
const COL_LIGA = 'league_name';

// 3. EL FILTRO MAESTRO (Ajusta los nombres exactos según vengan en tu CSV)
const LIGAS_TOP_5 = [
    'Spain Primera Division', 
    'English Premier League', 
    'German 1. Bundesliga', 
    'Italian Serie A', 
    'French Ligue 1'
]; 
// *Nota: Abre tu CSV un segundo y confirma que se llaman así. A veces las llaman "LaLiga", "Serie A", etc.

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function descargarYComprimir(url, rutaDestino) {
    if (fs.existsSync(rutaDestino)) return false; // Ya existe, saltamos

    const respuesta = await axios({
        url: url,
        method: 'GET',
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    await sharp(respuesta.data)
        .webp({ quality: 80 })
        .toFile(rutaDestino);
    
    return true;
}

async function procesarCSV() {
    const jugadores = [];
    const clubesProcesados = new Set(); // Para no descargar el escudo del Madrid 25 veces

    console.log('📖 Analizando y filtrando el dataset...');
    fs.createReadStream(RUTA_CSV)
        .pipe(csv())
        .on('data', (fila) => {
            // ¡EL FILTRO EN ACCIÓN! Solo guardamos si la liga coincide
            if (LIGAS_TOP_5.includes(fila[COL_LIGA])) {
                jugadores.push(fila);
            }
        })
        .on('end', async () => {
            console.log(`✅ Filtrado completado. Solo procesaremos ${jugadores.length} jugadores de la élite.`);
            
            for (let i = 0; i < jugadores.length; i++) {
                const j = jugadores[i];
                const rutaCara = path.join(CARPETA_CARAS, `${j[COL_ID_JUGADOR]}.webp`);
                const rutaEscudo = path.join(CARPETA_ESCUDOS, `${j[COL_ID_CLUB]}.webp`);

                try {
                    // Descargar Cara
                    const descargoCara = await descargarYComprimir(j[COL_URL_CARA], rutaCara);
                    
                    // Descargar Escudo (solo si no lo hemos descargado ya con otro jugador del mismo equipo)
                    let descargoEscudo = false;
                    if (!clubesProcesados.has(j[COL_ID_CLUB]) && j[COL_URL_ESCUDO]) {
                        descargoEscudo = await descargarYComprimir(j[COL_URL_ESCUDO], rutaEscudo);
                        clubesProcesados.add(j[COL_ID_CLUB]);
                    }

                    if (descargoCara || descargoEscudo) {
                        console.log(`[${i + 1}/${jugadores.length}] 📦 OK: ${j.short_name} ${descargoEscudo ? '(+ Escudo)' : ''}`);
                        await esperar(800); // 0.8 segundos de paz para el servidor
                    }

                } catch (error) {
                    console.error(`[${i + 1}/${jugadores.length}] ❌ Error con ${j.short_name}:`, error.message);
                }
            }
            console.log('\n🎉 ¡Extracción de la Élite completada! Disco duro a salvo.');
        });
}

procesarCSV();