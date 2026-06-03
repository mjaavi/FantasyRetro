import { supabase } from './supabase.js';
import { apiFetch } from './api.js';
import { getLigaActiva } from './leagues.js';

let activeAccess = {
    hasLigaAdmin: false,
    hasCatalogAdmin: false,
    hasPlatformAdmin: false
};

export async function actualizarAjustesAccess() {
    const btnAjustes = document.getElementById('btn-ajustes');
    if (!btnAjustes) return activeAccess;

    let hasLigaAdmin = false;
    let hasCatalogAdmin = false;
    let hasPlatformAdmin = false;

    // 1. Check League Admin
    try {
        const liga = getLigaActiva();
        if (liga) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && liga.admin_id === session.user.id) {
                hasLigaAdmin = true;
            }
        }
    } catch (_) {}

    // 2. Check Catalog Admin
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: roleData } = await supabase
                .from('platform_user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .eq('role', 'catalog_admin')
                .maybeSingle();
            if (roleData) {
                hasCatalogAdmin = true;
            }
        }
    } catch (_) {}

    // 3. Check Platform Admin
    try {
        const res = await apiFetch('/platform-admin/status');
        if (res.status === 'ok' && res.data?.isAdmin) {
            hasPlatformAdmin = true;
        }
    } catch (_) {}

    // Store state
    activeAccess = { hasLigaAdmin, hasCatalogAdmin, hasPlatformAdmin };

    // Show/hide sub-tabs in settings view
    const tabLiga = document.getElementById('ajustes-tab-liga');
    const tabCatalog = document.getElementById('ajustes-tab-catalogo');
    const tabPlatform = document.getElementById('ajustes-tab-platform');

    if (tabLiga) tabLiga.classList.toggle('hidden', !hasLigaAdmin);
    if (tabCatalog) tabCatalog.classList.toggle('hidden', !hasCatalogAdmin);
    if (tabPlatform) tabPlatform.classList.toggle('hidden', !hasPlatformAdmin);

    // Show/hide main navbar button
    const shouldShowAjustes = hasLigaAdmin || hasCatalogAdmin || hasPlatformAdmin;
    btnAjustes.classList.toggle('hidden', !shouldShowAjustes);

    // If currently on adjustments view but lost all rights, kick to dashboard
    const viewAjustes = document.getElementById('view-ajustes');
    if (viewAjustes && viewAjustes.style.display !== 'none' && !shouldShowAjustes) {
        window.switchView?.('view-dashboard', document.getElementById('btn-dashboard'));
    }

    return activeAccess;
}

export async function loadAjustes() {
    const access = await actualizarAjustesAccess();
    
    // Choose default active tab if none is currently selected/active
    let activeTab = window.currentAjustesTab;
    if (!activeTab || !isTabVisible(activeTab, access)) {
        if (access.hasLigaAdmin) {
            activeTab = 'liga';
        } else if (access.hasCatalogAdmin) {
            activeTab = 'catalogo';
        } else if (access.hasPlatformAdmin) {
            activeTab = 'platform';
        }
    }

    if (activeTab) {
        await switchAjustesTab(activeTab);
    }
}

function isTabVisible(tab, access) {
    if (tab === 'liga') return access.hasLigaAdmin;
    if (tab === 'catalogo') return access.hasCatalogAdmin;
    if (tab === 'platform') return access.hasPlatformAdmin;
    return false;
}

export async function switchAjustesTab(tabName) {
    window.currentAjustesTab = tabName;

    // Update active tab button classes (Liquid Glass Style)
    const tabs = {
        'liga': document.getElementById('ajustes-tab-liga'),
        'catalogo': document.getElementById('ajustes-tab-catalogo'),
        'platform': document.getElementById('ajustes-tab-platform'),
    };

    Object.entries(tabs).forEach(([name, button]) => {
        if (!button) return;
        if (name === tabName) {
            button.className = 'flex items-center gap-2 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 bg-blue-500/20 text-blue-400 border border-blue-500/30';
        } else {
            button.className = 'flex items-center gap-2 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 text-slate-400 hover:text-slate-200 border border-transparent';
        }
    });

    // Show/hide sub-panels
    const panels = {
        'liga': document.getElementById('view-admin'),
        'catalogo': document.getElementById('view-catalogo'),
        'platform': document.getElementById('view-platform-admin'),
    };

    Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;
        if (name === tabName) {
            panel.style.display = 'block';
            setTimeout(() => {
                panel.classList.remove('opacity-0');
                panel.classList.add('opacity-100');
            }, 10);
        } else {
            panel.style.display = 'none';
            panel.classList.remove('opacity-100');
            panel.classList.add('opacity-0');
        }
    });

    // Load corresponding module data dynamically!
    if (tabName === 'liga') {
        const { loadAdmin } = await import('./admin.js');
        await loadAdmin();
    } else if (tabName === 'catalogo') {
        const { loadCatalog } = await import('./catalog.js');
        await loadCatalog();
    } else if (tabName === 'platform') {
        const { loadPlatformAdmin } = await import('./platformAdmin.js');
        await loadPlatformAdmin();
    }
}

// Global injection
window.actualizarAjustesAccess = actualizarAjustesAccess;
window.loadAjustes = loadAjustes;
window.switchAjustesTab = switchAjustesTab;
