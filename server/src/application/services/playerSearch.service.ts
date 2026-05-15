// ─────────────────────────────────────────────────────────────────────────────
// PlayerSearchService — Orquesta la búsqueda de jugadores del catálogo
// Combina filtros, enriquecimiento de datos y marcado de disponibilidad en mercado.
// SRP: Solo responsable de la lógica de búsqueda, no de acceso a datos.
// ─────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../domain/errors/AppError';
import { IPlayerSearchRepository, PlayerSearchFilters } from '../../domain/ports/IPlayerSearchRepository';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { ILeagueMarketRepository, LeagueMarketPlayer } from '../../domain/ports/ILeagueMarketRepository';
import { IPlayerMarketValueRepository } from '../../domain/ports/IPlayerMarketValueRepository';
import { loadLeaguePlayerData } from '../../infrastructure/repositories/leaguePlayerDataHelper';
import { PlayerSearchResponseDTO, PlayerSearchResultDTO } from '../dtos/PlayerSearchDTO';
import { LeagueMarketValueProjector } from './economy/LeagueMarketValueProjector';
import { InitialPricingService } from './economy/InitialPricingService';
import { PlayerPosition } from '../../domain/models/player.models';

export class PlayerSearchService {

    private readonly pricingService = new InitialPricingService();

    constructor(
        private readonly searchRepo: IPlayerSearchRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly marketRepo: ILeagueMarketRepository,
        private readonly marketValueProjector: LeagueMarketValueProjector,
        private readonly marketValueRepo?: IPlayerMarketValueRepository,
    ) {}

    async searchPlayers(
        leagueId: number,
        filters: PlayerSearchFilters,
    ): Promise<PlayerSearchResponseDTO> {
        // 1. Obtener contexto de la liga
        const liga = await this.leagueRepo.findById(leagueId);
        if (!liga) throw new AppError('Liga no encontrada.', 404);

        const season = liga.season;
        const kaggleLeagueId = liga.kaggle_league_id ?? 1;

        // 2. Buscar IDs de jugadores que coinciden con los filtros
        const searchResult = await this.searchRepo.searchPlayers(
            kaggleLeagueId,
            season,
            filters,
        );

        if (!searchResult.playerApiIds.length) {
            return {
                players: [],
                totalCount: searchResult.totalCount,
                page: searchResult.page,
                pageSize: searchResult.pageSize,
            };
        }

        // 3. Enriquecer con datos completos del jugador (DRY: reutiliza helper)
        const playerData = await loadLeaguePlayerData(leagueId, searchResult.playerApiIds);

        // 4. Obtener mercado activo para marcar disponibilidad
        const marketPlayerMap = await this.buildMarketPlayerMap(leagueId);

        // 5. Obtener valores de mercado reales para TODOS los jugadores buscados
        //    (no solo los del mercado activo) desde la tabla player_market_values
        const allMarketValues = this.marketValueRepo
            ? await this.marketValueRepo.findMarketValues(leagueId, searchResult.playerApiIds)
            : [];
        const allMarketValueMap = new Map(allMarketValues.map(v => [v.playerApiId, v]));

        // 6. Mapear a DTOs
        const players: PlayerSearchResultDTO[] = searchResult.playerApiIds
            .map(playerApiId => {
                const player = playerData.get(playerApiId);
                if (!player) return null;

                const marketPlayer = marketPlayerMap.get(playerApiId);
                const isInMarket = Boolean(marketPlayer);
                const storedValue = allMarketValueMap.get(playerApiId);

                // Precio: si está en mercado usa el valor proyectado,
                // si no, usa el valor almacenado en player_market_values,
                // si tampoco existe, calcula el precio base con InitialPricingService
                // (misma fórmula que en el onboarding, DRY)
                const resolvedMarketValue = marketPlayer?.marketValue
                    ?? (storedValue ? storedValue.currentPrice : null)
                    ?? this.computeBasePrice(player.overall, player.position);

                return {
                    playerApiId,
                    name: player.name,
                    position: player.position,
                    realTeam: player.realTeam,
                    overall: player.overall,
                    playerFifaApiId: player.playerFifaApiId,
                    faceUrl: player.faceUrl,
                    clubLogoUrl: player.clubLogoUrl,
                    marketValue: resolvedMarketValue,
                    previousMarketValue: marketPlayer?.previousMarketValue
                        ?? (storedValue ? storedValue.previousPrice : null),
                    marketValueDelta: marketPlayer?.marketValueDelta
                        ?? (storedValue ? storedValue.lastVariation : 0),
                    marketValueChangePct: marketPlayer?.marketValueChangePct ?? 0,
                    lastAveragePoints: marketPlayer?.lastAveragePoints
                        ?? (storedValue ? storedValue.movingAveragePoints : null),
                    lastJornadaProcessed: marketPlayer?.lastJornadaProcessed
                        ?? (storedValue ? storedValue.lastJornadaProcessed : null),
                    isInMarket,
                } as PlayerSearchResultDTO;
            })
            .filter((p): p is PlayerSearchResultDTO => p !== null);

        return {
            players,
            totalCount: searchResult.totalCount,
            page: searchResult.page,
            pageSize: searchResult.pageSize,
        };
    }

    /**
     * Construye un Map playerApiId → LeagueMarketPlayer con los jugadores
     * activos del mercado para lookup rápido O(1).
     */
    private async buildMarketPlayerMap(leagueId: number): Promise<Map<number, LeagueMarketPlayer>> {
        try {
            const snapshots = await this.marketRepo.getActiveMarket(leagueId);

            const marketValues = this.marketValueRepo
                ? await this.marketValueRepo.findMarketValues(
                    leagueId,
                    snapshots.map(s => s.playerApiId),
                )
                : [];

            const projected = this.marketValueProjector.projectPlayers(
                snapshots,
                new Map(marketValues.map(v => [v.playerApiId, v])),
            );

            return new Map(projected.map(p => [p.playerApiId, p]));
        } catch {
            // Si no hay mercado activo, devolver mapa vacío
            return new Map();
        }
    }

    /**
     * Calcula el precio base de un jugador usando la misma fórmula
     * que el onboarding (InitialPricingService). Fallback cuando no hay
     * registro en player_market_values.
     */
    private computeBasePrice(overall: number, position: string): number {
        try {
            const result = this.pricingService.calculate({
                ovr: overall,
                position: position as PlayerPosition,
            });
            return result.price;
        } catch {
            // Si el overall es inválido o la posición no es válida, devolver 500.000 (mínimo)
            return 500_000;
        }
    }
}
