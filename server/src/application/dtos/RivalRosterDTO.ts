// ─────────────────────────────────────────────────────────────────────────────
// RivalRosterDTO — DTOs para la visualización de equipos rivales
// ─────────────────────────────────────────────────────────────────────────────

export interface RivalPlayerDTO {
    id: number;
    name: string;
    position: string;
    real_team: string;
    overall: number;
    is_starter: boolean;
    purchase_price: number;
    marketValue: number;
    releaseClause: number;
    playerFifaApiId: number | null;
    faceUrl: string | null;
    clubLogoUrl: string | null;
    /** Puntos en la jornada solicitada (null si no jugó esa jornada) */
    jornadaPts: number | null;
}

export interface RivalRosterResponseDTO {
    userId: string;
    username: string;
    teamName: string;
    leagueId: number;
    jornadaActual: number;
    jornadasDisponibles: number[];
    formationKey: string;
    titulares: RivalPlayerDTO[];
    suplentes: RivalPlayerDTO[];
    totalPoints: number;
}
