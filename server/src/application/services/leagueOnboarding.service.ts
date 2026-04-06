import { AppError } from '../../domain/errors/AppError';
import { ILeagueMarketRepository } from '../../domain/ports/ILeagueMarketRepository';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { LeagueMarketValueProjector } from './economy/LeagueMarketValueProjector';
import { InitialPricingService } from './economy/InitialPricingService';
import { loadLeaguePlayerData, LeaguePlayerData } from '../../infrastructure/repositories/leaguePlayerDataHelper';
import { PlayerPosition } from '../../domain/models/player.models';

const TARGET_MIN = 180_000_000;
const TARGET_MAX = 220_000_000;

export class LeagueOnboardingService {
    constructor(
        private readonly marketRepo: ILeagueMarketRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly pricingService: InitialPricingService = new InitialPricingService()
    ) {}

    /**
     * Asigna un equipo inicial aleatorio de 11 jugadores (1 PT, 4 DF, 4 MC, 2 DL)
     * cuyo valor este estrictamente entre TARGET_MIN y TARGET_MAX.
     */
    async assignInitialTeam(leagueId: number, userId: string): Promise<void> {
        console.log(`[LeagueOnboarding] Generando equipo inicial para usuario ${userId} en liga ${leagueId}...`);

        const liga = await this.leagueRepo.findById(leagueId);
        if (!liga) return;

        const season = liga.season;
        const kaggleLeagueId = liga.kaggle_league_id ?? 1;

        // 1. Obtener todos los jugadores de la liga/temporada, excluyendo los ya fichados en la liga
        const excluidos = await this.marketRepo.getPlayerIdsInLeague(leagueId);
        const playerIds = await this.marketRepo.getMatchPlayerIds(kaggleLeagueId, season, excluidos);

        if (playerIds.length < 11) {
            console.error('[LeagueOnboarding] No hay suficientes jugadores disponibles para armar un equipo inicial.');
            return;
        }

        // 2. Cargar datos de los jugadores y sus precios
        const playerDataMap = await loadLeaguePlayerData(leagueId, playerIds);
        const availablePlayers: (LeaguePlayerData & { price: number })[] = [];

        for (const player of playerDataMap.values()) {
            const priceResult = this.pricingService.calculate({
                ovr: player.overall,
                position: player.position as PlayerPosition,
            });
            availablePlayers.push({ ...player, price: priceResult.price });
        }

        // 3. Generar el equipo aleatorio ajustado a los limites de valor
        const selectedTeam = this.generateTeamStrictSum(availablePlayers);
        
        if (!selectedTeam || selectedTeam.length !== 11) {
            console.error('[LeagueOnboarding] Fallo generando el equipo para el budget indicado.');
            return;
        }

        // 4. Inscribirlos en el `user_roster`
        let totalValue = 0;
        for (const player of selectedTeam) {
            totalValue += player.price;
            try {
                // Al insertarlos manualmente aqui, los marcamos como titulares directamente para que el usuario no tenga que ponerlos
                // Insertamos asincronamente.
                await this.marketRepo.addPlayerToRoster(leagueId, userId, player.id, player.price, true);
            } catch (err: any) {
                console.error(`[LeagueOnboarding] Error al insertar jugador ${player.id}: ${err.message}`);
            }
        }

        console.log(`[LeagueOnboarding] Equipo generado con exito. Valoracion total: ${totalValue}`);
    }

    private generateTeamStrictSum(players: (LeaguePlayerData & { price: number })[], iterationLimit = 1000): (LeaguePlayerData & { price: number })[] {
        // Agrupar jugadores disponibles por posicion
        const byPos: Record<string, (LeaguePlayerData & { price: number })[]> = {
            [PlayerPosition.PT]: [],
            [PlayerPosition.DF]: [],
            [PlayerPosition.MC]: [],
            [PlayerPosition.DL]: []
        };

        for (const p of players) {
            if (byPos[p.position]) byPos[p.position].push(p);
        }

        // Desordenar cada arreglo
        const shuffle = (array: any[]) => array.sort(() => 0.5 - Math.random());
        for (const pos in byPos) shuffle(byPos[pos]);

        // Requerimientos (11 total)
        const requirements = [
            { pos: PlayerPosition.PT, count: 1 },
            { pos: PlayerPosition.DF, count: 4 },
            { pos: PlayerPosition.MC, count: 4 },
            { pos: PlayerPosition.DL, count: 2 },
        ];

        let selectedTeam: (LeaguePlayerData & { price: number })[] = [];
        
        // Seleccion inicial ingenua
        for (const req of requirements) {
            if (byPos[req.pos].length < req.count) return []; // Fallo critico
            selectedTeam.push(...byPos[req.pos].slice(0, req.count));
        }

        let totalVal = selectedTeam.reduce((acc, p) => acc + p.price, 0);

        for (let iter = 0; iter < iterationLimit; iter++) {
            if (totalVal >= TARGET_MIN && totalVal <= TARGET_MAX) {
                return selectedTeam; // Exito
            }

            // Elegir un cambio aleatorio
            const posToChange = requirements[Math.floor(Math.random() * requirements.length)].pos;
            const currentOfPos = selectedTeam.filter(p => p.position === posToChange);
            const playerToReplace = currentOfPos[Math.floor(Math.random() * currentOfPos.length)];
            
            const poolOfPos = byPos[posToChange].filter(p => !selectedTeam.find(s => s.id === p.id));
            if (!poolOfPos.length) continue;

            let newPlayer;
            if (totalVal < TARGET_MIN) {
                // Buscamos uno mas caro
                const richerPool = poolOfPos.filter(p => p.price > playerToReplace.price);
                newPlayer = richerPool.length > 0 ? richerPool[Math.floor(Math.random() * richerPool.length)] : null;
            } else {
                // Buscamos uno mas barato
                const cheaperPool = poolOfPos.filter(p => p.price < playerToReplace.price);
                newPlayer = cheaperPool.length > 0 ? cheaperPool[Math.floor(Math.random() * cheaperPool.length)] : null;
            }

            if (newPlayer) {
                selectedTeam = selectedTeam.filter(p => p.id !== playerToReplace.id);
                selectedTeam.push(newPlayer);
                totalVal = totalVal - playerToReplace.price + newPlayer.price;
            }
        }

        // Si excedemos el limite de iteraciones, devolvemos el equipo mas cercano
        return selectedTeam;
    }
}
