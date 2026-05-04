// --- ANIMACIÓN DE CARGA ---

function mostrarCarga() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function ocultarCarga() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.style.opacity = '';
    }, 250);
}

// --- NAVEGACIÓN ENTRE PANTALLAS (SPA) ---
function switchView(viewId, clickedButton) {
    const views = ['view-dashboard', 'view-liga', 'view-mercado', 'view-equipo', 'view-perfil', 'view-admin', 'view-catalogo'];

    // 1. Ocultamos TODAS las pantallas forzando el estilo en línea (A prueba de fallos)
    views.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none'; // Esto anula el conflicto con Tailwind
            element.classList.remove('opacity-100');
            element.classList.add('opacity-0');
        }
    });

    // 2. Mostramos la pantalla activa
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = ''; // Restauramos su comportamiento normal (grid o block)
        setTimeout(() => {
            activeView.classList.remove('opacity-0');
            activeView.classList.add('opacity-100');
        }, 10);

        // Cargamos los datos en background silenciosamente (ya están en caché por la pre-carga global)
        if (viewId === 'view-liga' && typeof window.loadClasificacion === 'function') {
            window.loadClasificacion();
        } else if (viewId === 'view-dashboard') {
            if (typeof window.loadDashboard === 'function') window.loadDashboard();
            const players = activeView.querySelectorAll('.player-card');
            players.forEach((player, index) => {
                player.style.animation = 'none';
                player.offsetHeight;
                player.style.animation = `popIn 0.4s ease-out ${index * 0.05}s forwards`;
            });
        } else if (viewId === 'view-mercado' && typeof window.loadMarket === 'function') {
            window.loadMarket();
        } else if (viewId === 'view-equipo' && typeof window.loadRoster === 'function') {
            window.loadRoster();
        } else if (viewId === 'view-perfil' && typeof window.loadProfile === 'function') {
            window.loadProfile();
        } else if (viewId === 'view-admin' && typeof window.loadAdmin === 'function') {
            window.loadAdmin();
        } else if (viewId === 'view-catalogo' && typeof window.loadCatalog === 'function') {
            window.loadCatalog();
        }
    }

    // Si no pasaron el botón (ej. llamado desde código), deducirlo por la vista
    if (!clickedButton) {
        const viewToBtn = {
            'view-dashboard': 'btn-dashboard',
            'view-liga': 'btn-liga',
            'view-mercado': 'btn-mercado',
            'view-equipo': 'btn-equipo',
            'view-catalogo': 'btn-catalogo',
            'view-admin': 'btn-admin',
            'view-perfil': 'btn-perfil'
        };
        const idMap = viewToBtn[viewId];
        if (idMap) clickedButton = document.getElementById(idMap);
    }

    // 3. Estilos de los botones Pill Nav (VERSIÓN LIQUID GLASS)
    if (clickedButton) {
        // Reiniciamos a estado inactivo (pero respetando los estilos base y hidden)
        document.querySelectorAll('.nav-btn').forEach(btn => {
            // Removemos las clases de estado activo
            btn.classList.remove('nav-btn-active');
            
            // Si es el de perfil gestionamos su borde personalizado
            if (btn.id === 'btn-perfil') {
                btn.classList.remove('border-blue-500');
                btn.classList.add('border-white/20');
            }
        });
        
        // Encendemos el botón pulsado
        if (clickedButton.id !== 'btn-perfil') {
            clickedButton.classList.add('nav-btn-active');
        } else {
            clickedButton.classList.remove('border-white/20');
            clickedButton.classList.add('border-blue-500');
        }
    }
}

// --- FUNCIONALIDAD DEL MENÚ DESPLEGABLE (PERFIL) ---
function toggleProfileDropdown(event) {
    // Evita que el clic se propague al documento y lo cierre inmediatamente
    event.stopPropagation();
    
    const dropdown = document.getElementById('profile-dropdown');
    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
        // Abrir
        dropdown.classList.remove('hidden');
        // Pequeño timeout para que la animación de CSS (transición) funcione
        setTimeout(() => {
            dropdown.classList.remove('opacity-0', '-translate-y-2');
            dropdown.classList.add('opacity-100', 'translate-y-0');
        }, 10);
    } else {
        // Cerrar
        dropdown.classList.remove('opacity-100', 'translate-y-0');
        dropdown.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 200); // 200ms es el tiempo que dura la transición
    }
}

// Cerrar el menú si hacemos clic en cualquier otra parte de la pantalla
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('opacity-100', 'translate-y-0');
        dropdown.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 200);
    }
});
