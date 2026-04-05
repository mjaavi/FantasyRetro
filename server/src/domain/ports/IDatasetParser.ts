import { PlayerStats } from '../models/scoring.models';

export interface RawMatchRecord {
    id:               number;
    season:           string;
    stage:            number;
    home_team_api_id: number | string;
    away_team_api_id: number | string;
    home_team_goal:   string | number;
    away_team_goal:   string | number;
    goal?:            string;
    card?:            string;
    shoton?:          string;
    shotoff?:         string;
    foulcommit?:      string;
    cross?:           string;
    possession?:      string;
    [key: string]:    unknown;
}

export interface IDatasetParser {
    obtenerPartidosJornada(season: string, jornada?: number, kaggleLeagueId?: number): Promise<RawMatchRecord[]>;
    parsearPartido(match: RawMatchRecord): PlayerStats[];
}
