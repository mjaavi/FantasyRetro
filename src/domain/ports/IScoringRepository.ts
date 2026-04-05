import { IJugador } from '../interfaces/IJugador';

export interface IScoringRepository {
    findPlayersByIds(playerIds: number[], season: string): Promise<IJugador[]>;
}
