import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../domain/errors/AppError';

const PLAYER_FACE_EDITIONS = ['16', '15', '14', '13', '12', '11', '10', '09', '08'] as const;

function parsePositiveInt(raw: string | undefined): number {
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new ValidationError('ID de asset invalido.');
    }

    return value;
}

function buildSofifaPlayerFaceUrl(playerFifaApiId: number, edition: string): string {
    const paddedId = String(playerFifaApiId).padStart(6, '0');
    return `https://cdn.sofifa.net/players/${paddedId.slice(0, 3)}/${paddedId.slice(3)}/${edition}_120.png`;
}

function buildSofifaClubLogoUrl(teamFifaApiId: number): string {
    return `https://cdn.sofifa.net/teams/${teamFifaApiId}/60.png`;
}

async function proxyImage(res: Response, candidateUrls: string[]): Promise<boolean> {
    for (const candidateUrl of candidateUrls) {
        try {
            const response = await fetch(candidateUrl, {
                redirect: 'follow',
                headers: {
                    'User-Agent': 'RetroFantasy/1.0',
                },
            });

            if (!response.ok) {
                continue;
            }

            const body = Buffer.from(await response.arrayBuffer());
            res.setHeader('Content-Type', response.headers.get('content-type') ?? 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.send(body);
            return true;
        } catch {
            // Si un candidato falla, seguimos con el siguiente.
        }
    }

    return false;
}

export class AssetsController {
    proxyPlayerFace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const playerFifaApiId = parsePositiveInt(req.params.playerFifaApiId);
            const preferredEdition = String(req.query.edition ?? '').trim();
            const editions = preferredEdition && PLAYER_FACE_EDITIONS.includes(preferredEdition as typeof PLAYER_FACE_EDITIONS[number])
                ? [preferredEdition, ...PLAYER_FACE_EDITIONS.filter(edition => edition !== preferredEdition)]
                : [...PLAYER_FACE_EDITIONS];

            const candidateUrls = editions.map(edition => buildSofifaPlayerFaceUrl(playerFifaApiId, edition));
            const served = await proxyImage(res, candidateUrls);

            if (!served) {
                res.status(404).json({ status: 'error', message: 'Imagen de jugador no encontrada.' });
            }
        } catch (error) {
            next(error);
        }
    };

    proxyClubLogo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamFifaApiId = parsePositiveInt(req.params.teamFifaApiId);
            const served = await proxyImage(res, [buildSofifaClubLogoUrl(teamFifaApiId)]);

            if (!served) {
                res.status(404).json({ status: 'error', message: 'Escudo no encontrado.' });
            }
        } catch (error) {
            next(error);
        }
    };
}
