import { AppError } from '../../domain/errors/AppError';
import {
    ILeagueMarketRepository,
    LeagueBid,
    LeagueMarketPlayer,
} from '../../domain/ports/ILeagueMarketRepository';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { LeagueMarketValueProjector } from './economy/LeagueMarketValueProjector';

const JUGADORES_POR_DIA = 30;
const HORAS_MERCADO = Number(process.env.MARKET_HOURS ?? 24);

type MarketOpeningPayload = {
    expiresAt: Date;
    playerIds: number[];
};

export interface RegenerateLeagueMarketResult {
    expiresAt: string;
    importeDevuelto: number;
    jugadoresNuevos: number;
    jugadoresRetirados: number;
    mercadoPrevioActivo: boolean;
    pujasDevueltas: number;
    usuariosReembolsados: number;
}

export class LeagueMarketService {
    constructor(
        private readonly repo: ILeagueMarketRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly marketValueProjector: LeagueMarketValueProjector = new LeagueMarketValueProjector(),
    ) {}

    async openMarket(leagueId: number): Promise<{ jugadores: number; expiresAt: string }> {
        console.log(`[LeagueMarket] Abriendo mercado para liga ${leagueId}...`);

        const mercadoActivo = await this.repo.getMarketForLeague(leagueId);
        if (mercadoActivo.length) {
            console.log(`[LeagueMarket] Resolviendo ${mercadoActivo.length} jugadores del mercado anterior...`);
            try {
                await this.closeMarket(leagueId);
            } catch (err: any) {
                console.log(`[LeagueMarket] Cierre previo: ${err.message}`);
            }
        }

        const { expiresAt, playerIds } = await this.prepareMarketOpening(leagueId);
        await this.repo.openMarket(leagueId, playerIds, expiresAt);

        console.log(`[LeagueMarket] Mercado abierto. Jugadores: ${playerIds.length}. Expira: ${expiresAt.toISOString()}`);
        return { jugadores: playerIds.length, expiresAt: expiresAt.toISOString() };
    }

    async regenerateMarketSafely(leagueId: number): Promise<RegenerateLeagueMarketResult> {
        console.log(`[LeagueMarket] Regenerando mercado de forma segura para liga ${leagueId}...`);

        const { expiresAt, playerIds } = await this.prepareMarketOpening(leagueId);
        const mercadoActivo = await this.repo.getMarketForLeague(leagueId);
        const mercadoPrevioActivo = mercadoActivo.length > 0;
        const pujas = mercadoPrevioActivo ? await this.repo.getBidsForMarket(leagueId) : [];
        const { importeDevuelto, usuariosReembolsados } = await this.refundBids(pujas);

        if (pujas.length) {
            await this.repo.clearBidsForLeague(leagueId);
        }

        if (mercadoPrevioActivo) {
            await this.repo.closeMarket(leagueId);
        }

        await this.repo.openMarket(leagueId, playerIds, expiresAt);

        console.log(
            `[LeagueMarket] Mercado regenerado para liga ${leagueId}. Retirados: ${mercadoActivo.length}, nuevos: ${playerIds.length}.`,
        );

        return {
            expiresAt: expiresAt.toISOString(),
            importeDevuelto,
            jugadoresNuevos: playerIds.length,
            jugadoresRetirados: mercadoActivo.length,
            mercadoPrevioActivo,
            pujasDevueltas: pujas.length,
            usuariosReembolsados,
        };
    }

    async getMarket(leagueId: number): Promise<LeagueMarketPlayer[]> {
        const jugadores = await this.obtenerMercadoValorizado(leagueId);

        if (!jugadores.length) {
            try {
                await this.openMarket(leagueId);
                return this.obtenerMercadoValorizado(leagueId);
            } catch (err: any) {
                console.error(`[LeagueMarket] Error abriendo mercado automatico para liga ${leagueId}:`, err.message);
                return [];
            }
        }

        return jugadores;
    }

    async getUserBids(leagueId: number, userId: string): Promise<LeagueBid[]> {
        return this.repo.getUserBidsForLeague(leagueId, userId);
    }

    async placeBid(
        leagueId: number,
        userId: string,
        playerApiId: number,
        amount: number,
    ): Promise<{ message: string; newBudget: number }> {
        const mercado = await this.obtenerMercadoValorizado(leagueId);
        const jugadorEnMercado = mercado.find(jugador => jugador.playerApiId === playerApiId);

        if (!jugadorEnMercado) {
            throw new AppError('Este jugador no esta disponible en el mercado de tu liga.', 404);
        }

        const pujaPrevia = await this.repo.getBidByUserAndPlayer(leagueId, userId, playerApiId);
        const budget = await this.repo.getUserBudget(userId);
        const costeReal = pujaPrevia ? amount - pujaPrevia.amount : amount;

        if (costeReal > budget) {
            throw new AppError('No tienes presupuesto suficiente para esta puja.', 400);
        }

        await this.repo.upsertBid(leagueId, userId, playerApiId, amount);

        const nuevoBudget = budget - costeReal;
        await this.repo.updateUserBudget(userId, nuevoBudget);

        return {
            message: pujaPrevia ? 'Puja actualizada.' : 'Puja registrada.',
            newBudget: nuevoBudget,
        };
    }

    async cancelBid(
        leagueId: number,
        userId: string,
        playerApiId: number,
    ): Promise<{ message: string; newBudget: number }> {
        const puja = await this.repo.getBidByUserAndPlayer(leagueId, userId, playerApiId);
        if (!puja) {
            throw new AppError('No tienes ninguna puja sobre este jugador.', 404);
        }

        const budget = await this.repo.getUserBudget(userId);
        await this.repo.deleteBid(leagueId, userId, playerApiId);

        const nuevoBudget = budget + puja.amount;
        await this.repo.updateUserBudget(userId, nuevoBudget);

        return { message: 'Puja cancelada. Presupuesto devuelto.', newBudget: nuevoBudget };
    }

    async closeMarket(leagueId: number): Promise<{ resueltos: number; sin_pujas: number }> {
        const mercado = await this.repo.getMarketForLeague(leagueId);
        if (!mercado.length) {
            throw new AppError('No hay mercado activo en esta liga.', 404);
        }

        const todasLasPujas = await this.repo.getBidsForMarket(leagueId);
        let resueltos = 0;
        let sinPujas = 0;

        for (const jugador of mercado) {
            const pujas = todasLasPujas
                .filter(puja => puja.playerApiId === jugador.playerApiId)
                .sort((a, b) => b.amount - a.amount);

            if (!pujas.length) {
                sinPujas++;
                continue;
            }

            const ganador = pujas[0];
            const perdedores = pujas.slice(1);

            try {
                await this.repo.addPlayerToRoster(leagueId, ganador.userId, jugador.playerApiId, ganador.amount);
            } catch (err: any) {
                console.error(`[CloseMarket] Error anadiendo jugador ${jugador.playerApiId} al roster:`, err.message);
            }

            for (const perdedor of perdedores) {
                const budgetActual = await this.repo.getUserBudget(perdedor.userId);
                await this.repo.updateUserBudget(perdedor.userId, budgetActual + perdedor.amount);
            }

            resueltos++;
        }

        await this.repo.clearBidsForLeague(leagueId);
        await this.repo.closeMarket(leagueId);

        console.log(`[CloseMarket] Liga ${leagueId} - resueltos: ${resueltos}, sin pujas: ${sinPujas}`);
        return { resueltos, sin_pujas: sinPujas };
    }

    async processExpiredMarkets(): Promise<{ liga: number; resueltos: number; sin_pujas: number }[]> {
        const expiredLeagueIds = await this.repo.getExpiredMarkets();
        const resultados = [];

        for (const leagueId of expiredLeagueIds) {
            try {
                const resultado = await this.closeMarket(leagueId);
                await this.openMarket(leagueId);
                resultados.push({ liga: leagueId, ...resultado });
            } catch (err: any) {
                console.error(`[LeagueMarket] Error procesando liga ${leagueId}:`, err.message);
            }
        }

        return resultados;
    }

    private async seleccionarJugadores(
        season: string,
        kaggleLeagueId: number,
        excluidos: number[],
        cantidad: number,
    ): Promise<number[]> {
        const candidates = await this.repo.getMatchPlayerIds(kaggleLeagueId, season, excluidos);

        if (!candidates.length) {
            throw new AppError(
                `No se encontraron jugadores del dataset para la competicion ${kaggleLeagueId} en ${season}.`,
                404,
            );
        }

        return candidates
            .map(id => ({ id, r: Math.random() }))
            .sort((a, b) => a.r - b.r)
            .slice(0, cantidad)
            .map(item => item.id);
    }

    private async prepareMarketOpening(leagueId: number): Promise<MarketOpeningPayload> {
        const liga = await this.obtenerLiga(leagueId);
        const season = liga.season as string;
        const kaggleLeagueId = liga.kaggle_league_id ?? 1;
        const yaFichados = await this.repo.getPlayerIdsInLeague(leagueId);
        const playerIds = await this.seleccionarJugadores(season, kaggleLeagueId, yaFichados, JUGADORES_POR_DIA);

        if (!playerIds.length) {
            throw new AppError('No hay jugadores disponibles para abrir el mercado.', 404);
        }

        return {
            expiresAt: new Date(Date.now() + HORAS_MERCADO * 60 * 60 * 1000),
            playerIds,
        };
    }

    private async refundBids(bids: LeagueBid[]): Promise<{ importeDevuelto: number; usuariosReembolsados: number }> {
        if (!bids.length) {
            return { importeDevuelto: 0, usuariosReembolsados: 0 };
        }

        const refundsByUser = new Map<string, number>();
        for (const bid of bids) {
            refundsByUser.set(bid.userId, (refundsByUser.get(bid.userId) ?? 0) + bid.amount);
        }

        for (const [userId, refundAmount] of refundsByUser.entries()) {
            const budgetActual = await this.repo.getUserBudget(userId);
            await this.repo.updateUserBudget(userId, budgetActual + refundAmount);
        }

        return {
            importeDevuelto: bids.reduce((sum, bid) => sum + bid.amount, 0),
            usuariosReembolsados: refundsByUser.size,
        };
    }

    private async obtenerLiga(leagueId: number) {
        const liga = await this.leagueRepo.findById(leagueId);
        if (!liga) {
            throw new AppError('Liga no encontrada.', 404);
        }
        return liga;
    }

    private async obtenerMercadoValorizado(leagueId: number): Promise<LeagueMarketPlayer[]> {
        const snapshots = await this.repo.getActiveMarket(leagueId);
        return this.marketValueProjector.projectPlayers(snapshots);
    }
}
