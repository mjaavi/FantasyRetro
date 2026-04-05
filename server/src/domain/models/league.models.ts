// ─────────────────────────────────────────────────────────────────────────────
// domain/models/league.models.ts
//
// Entidades del dominio relacionadas con ligas y participantes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entidad principal de una liga fantasy.
 */
export interface FantasyLeague {
    readonly id:              number;
    readonly name:            string;
    readonly inviteCode:      string;
    readonly season:          string;
    readonly adminId:         string;
    readonly kaggleLeagueId:  number;
    readonly jornadaActual:   number;
    readonly createdAt:       string;
}

/**
 * Participante de una liga con su perfil público.
 */
export interface LeagueParticipant {
    readonly userId:   string;
    readonly leagueId: number;
    readonly profile?: {
        readonly username:  string;
        readonly teamName:  string;
        readonly budget:    number;
    };
}

/**
 * Temporadas históricas disponibles en el dataset de Kaggle.
 */
export const TEMPORADAS_DISPONIBLES = [
    '2008/2009', '2009/2010', '2010/2011', '2011/2012',
    '2012/2013', '2013/2014', '2014/2015', '2015/2016',
] as const;

export type Temporada = typeof TEMPORADAS_DISPONIBLES[number];