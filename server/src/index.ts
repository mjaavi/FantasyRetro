// ─────────────────────────────────────────────────────────────────────────────
// index.ts — Composition Root (Raíz de Composición)
//
// Es el ÚNICO lugar del sistema donde se instancian e inyectan dependencias.
// Sigue el patrón Pure DI (Dependency Injection sin contenedor externo).
//
// Flujo de dependencias (Clean Architecture):
//   domain ← application ← infrastructure
//
// Este archivo orquesta la construcción de todos los objetos, de dentro a fuera:
//   1. Infrastructure: DB client + Repositories + Parser
//   2. Application:    Servicios puros + Servicios de aplicación
//   3. Infrastructure: Controllers + Routers
//   4. Server:         Express + Middleware + Rutas
// ─────────────────────────────────────────────────────────────────────────────

import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv    from 'dotenv';
import path      from 'path';

dotenv.config();

// ── 1. Infrastructure: DB ─────────────────────────────────────────────────────
import { supabaseAdmin }                   from './infrastructure/supabase.client';
import { DatasetParser }                   from './infrastructure/parser/DatasetParser';
import { SupabaseLeagueRepository }        from './infrastructure/repositories/SupabaseLeagueRepository';
import { SupabaseLeagueMarketRepository }  from './infrastructure/repositories/SupabaseLeagueMarketRepository';
import { SupabaseMarketRepository }        from './infrastructure/repositories/SupabaseMarketRepository';
import { SupabaseRankingRepository }       from './infrastructure/repositories/SupabaseRankingRepository';
import { SupabaseRosterRepository }        from './infrastructure/repositories/SupabaseRosterRepository';
import { SupabaseScoringRepository }       from './infrastructure/repositories/SupabaseScoringRepository';
import { SupabaseSeedRepository }          from './infrastructure/repositories/SupabaseSeedRepository';
import { SupabaseDashboardRepository }     from './infrastructure/repositories/SupabaseDashboardRepository';
import { SupabaseAdminRepository }         from './infrastructure/repositories/SupabaseAdminRepository';
import { SupabaseFixturesRepository }      from './infrastructure/repositories/SupabaseFixturesRepository';
import { SupabaseCatalogRepository }       from './infrastructure/repositories/SupabaseCatalogRepository';

const leagueRepo       = new SupabaseLeagueRepository();
const leagueMarketRepo = new SupabaseLeagueMarketRepository();
const marketRepo       = new SupabaseMarketRepository();
const rankingRepo      = new SupabaseRankingRepository();
const rosterRepo       = new SupabaseRosterRepository();
const scoringRepo      = new SupabaseScoringRepository();
const seedRepo         = new SupabaseSeedRepository();
const dashboardRepo    = new SupabaseDashboardRepository();
const adminRepo        = new SupabaseAdminRepository(supabaseAdmin);
const fixturesRepo     = new SupabaseFixturesRepository(supabaseAdmin);
const datasetParser    = new DatasetParser(supabaseAdmin);
const catalogRepo      = new SupabaseCatalogRepository(supabaseAdmin);

// ── 2. Application: Servicios puros (sin I/O) ─────────────────────────────────
import { ScoringEngine }             from './application/services/scoring/ScoringEngine';

const scoringEngine          = new ScoringEngine();

// ── 3. Application: Servicios de aplicación (con ports inyectados) ────────────
import { LeagueMarketService } from './application/services/leagueMarket.service';
import { LeagueService }       from './application/services/league.service';
import { MarketService }       from './application/services/market.service';
import { RankingService }      from './application/services/ranking.service';
import { RosterService }       from './application/services/roster.service';
import { ScoringService }      from './application/services/scoring.service';
import { SeedService }         from './application/services/seed.service';
import { LeagueOnboardingService } from './application/services/leagueOnboarding.service';
import { AdminService }        from './application/services/admin.service';
import { DashboardService }    from './application/services/dashboard.service';
import { CatalogService }      from './application/services/catalog.service';

const leagueMarketService = new LeagueMarketService(leagueMarketRepo, leagueRepo);
const leagueOnboardingSvc = new LeagueOnboardingService(leagueMarketRepo, leagueRepo);
const catalogService      = new CatalogService(catalogRepo);
const leagueService       = new LeagueService(leagueRepo, catalogService, leagueMarketService, leagueOnboardingSvc);
const marketService       = new MarketService(marketRepo);
const rankingService      = new RankingService(leagueRepo, rankingRepo);
const rosterService       = new RosterService(rosterRepo);
const scoringService      = new ScoringService(scoringRepo, datasetParser, scoringEngine);
const seedService         = new SeedService(seedRepo);
const adminService        = new AdminService(adminRepo, datasetParser, scoringEngine);
const dashboardService    = new DashboardService(dashboardRepo, rankingRepo, leagueRepo, fixturesRepo);

// ── 4. Infrastructure: Controllers ───────────────────────────────────────────
import { LeagueController }       from './presentation/controllers/league.controller';
import { LeagueMarketController } from './presentation/controllers/leagueMarket.controller';
import { MarketController }       from './presentation/controllers/market.controller';
import { RankingController }      from './presentation/controllers/ranking.controller';
import { RosterController }       from './presentation/controllers/roster.controller';
import { ScoringController }      from './presentation/controllers/scoring.controller';
import { SeedController }         from './presentation/controllers/seed.controller';
import { AdminController }        from './presentation/controllers/admin.controller';
import { DashboardController }    from './presentation/controllers/dashboard.controller';
import { FixturesController }     from './presentation/controllers/fixtures.controller';
import { AssetsController }       from './presentation/controllers/assets.controller';
import { CatalogController }      from './presentation/controllers/catalog.controller';

const leagueCtrl       = new LeagueController(leagueService, catalogService);
const leagueMarketCtrl = new LeagueMarketController(leagueMarketService);
const marketCtrl       = new MarketController(marketService);
const rankingCtrl      = new RankingController(rankingService);
const rosterCtrl       = new RosterController(rosterService);
const scoringCtrl      = new ScoringController(scoringService);
const seedCtrl         = new SeedController(seedService);
const adminCtrl        = new AdminController(adminService, leagueMarketService);
const dashboardCtrl    = new DashboardController(dashboardService);
const fixturesCtrl     = new FixturesController(fixturesRepo);
const assetsCtrl       = new AssetsController();
const catalogCtrl      = new CatalogController(catalogService);

// ── 5. Infrastructure: Routers ────────────────────────────────────────────────
import { createLeagueRouter }       from './presentation/routes/league.routes';
import { createLeagueMarketRouter } from './presentation/routes/leagueMarket.routes';
import { createMarketRouter }       from './presentation/routes/market.routes';
import { createRankingRouter }      from './presentation/routes/ranking.routes';
import { createRosterRouter }       from './presentation/routes/roster.routes';
import { createScoringRouter }      from './presentation/routes/scoring.routes';
import { createSeedRouter }         from './presentation/routes/seed.routes';
import { createAdminRouter }        from './presentation/routes/admin.routes';
import { createDashboardRouter }    from './presentation/routes/dashboard.routes';
import { createFixturesRouter }     from './presentation/routes/fixtures.routes';
import { createConfigRouter }       from './presentation/routes/config.routes';
import { createAssetsRouter }       from './presentation/routes/assets.routes';
import { createCatalogRouter }      from './presentation/routes/catalog.routes';
import { errorHandler }             from './presentation/middleware/errorHandler.middleware';

// ── 6. Infrastructure: Cron ───────────────────────────────────────────────────
import { MarketCron } from './presentation/cron/marketCron';
const marketCron = new MarketCron(leagueMarketService);

// ── 7. Express App ────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT ?? 3000;

// IMPORTANTE: Render y Cloudflare actúan como proxies inversos.
// Sin trust proxy, express-rate-limit ve la IP del proxy (compartida por TODOS
// los usuarios) en lugar de la IP real del cliente, lo que provoca que el rate
// limit se alcance rápidamente y bloquee a todos los usuarios a la vez.
// Con trust proxy = 1 Express usa X-Forwarded-For para la IP real del cliente.
app.set('trust proxy', 1);

// En producción Helmet usa sus defaults estrictos (solo se expone la API, no HTML).
// En dev también servimos las páginas HTML estáticas, que usan CDNs externos
// (Tailwind, Supabase vía JSDelivr, Google Fonts) y scripts inline.
// NODE_ENV=production en Render → esta rama nunca llega a producción.
const IS_PROD = process.env.NODE_ENV === 'production';
app.use(helmet({
    contentSecurityPolicy: IS_PROD ? undefined : {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'",
                          "https://cdn.tailwindcss.com",
                          "https://cdn.jsdelivr.net"],
            styleSrc:    ["'self'", "'unsafe-inline'",
                          "https://fonts.googleapis.com",
                          "https://cdn.tailwindcss.com"],
            fontSrc:     ["'self'", "https://fonts.gstatic.com"],
            imgSrc:      ["'self'", "data:", "https:"],
            connectSrc:  ["'self'", "https://*.supabase.co",
                          "http://localhost:*"],
        },
    },
}));

// En dev el frontend se sirve desde el mismo servidor (localhost:3000), por lo que
// las peticiones llegan con Origin: http://localhost:3000. Lo añadimos automáticamente
// para no requerir configuración manual en ALLOWED_ORIGINS durante el desarrollo.
const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
const allowedOrigins    = IS_PROD
    ? configuredOrigins
    : [...new Set([...configuredOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000'])];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // 300 requests por IP real cada 15 min en producción.
    // Con trust proxy activo, cada usuario usa su IP real (no la del proxy
    // compartido), por lo que este límite es realmente por usuario individual.
    // La app hace ~10-15 llamadas al cargar, así que 300 es más que suficiente.
    max: process.env.NODE_ENV === 'production' ? 300 : 1000,
    standardHeaders: true, legacyHeaders: false,
    message: { status: 'error', message: 'Demasiadas peticiones. Inténtalo de nuevo en 15 minutos.' },
});
app.use('/api/assets', createAssetsRouter(assetsCtrl));
app.use('/api', apiLimiter);

// ── 8. Registro de rutas ──────────────────────────────────────────────────────
app.use('/api', createLeagueRouter(leagueCtrl));
app.use('/api', createLeagueMarketRouter(leagueMarketCtrl));
app.use('/api', createMarketRouter(marketCtrl));
app.use('/api', createRankingRouter(rankingCtrl));
app.use('/api', createRosterRouter(rosterCtrl));
app.use('/api', createScoringRouter(scoringCtrl));
app.use('/api', createSeedRouter(seedCtrl));
app.use('/api', createAdminRouter(adminCtrl));
app.use('/api', createDashboardRouter(dashboardCtrl));
app.use('/api', createFixturesRouter(fixturesCtrl));
app.use('/api', createConfigRouter());
app.use('/api', createCatalogRouter(catalogCtrl));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 9. Frontend estático (solo desarrollo) ────────────────────────────────────
// En producción Cloudflare Pages sirve el frontend; Express solo expone la API.
// __dirname apunta a server/src/ (tsx) o server/dist/ (compilado).
// En ambos casos ../../client/src resuelve correctamente.
if (process.env.NODE_ENV !== 'production') {
    const clientDir = path.join(__dirname, '../../client/src');
    app.use(express.static(clientDir, {
        etag: false,
        lastModified: false,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        },
    }));
    console.log(`🗂️  Frontend estático: ${clientDir}`);
}

app.use(errorHandler);

// ── 10. Arranque ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    marketCron.iniciar();
});

export default app;
