// infrastructure/http/controllers/fixtures.controller.ts
import { Request, Response, NextFunction } from 'express';
import { IFixturesRepository } from '../../domain/ports/IFixturesRepository';

export class FixturesController {
    constructor(private readonly fixturesRepo: IFixturesRepository) {}

    getFixtures = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const jornada  = Number(req.query.jornada);
            const userId   = req.userId!;
            const data = await this.fixturesRepo.getFixtures(leagueId, jornada, userId);
            res.json({ status: 'ok', data });
        } catch (err) { next(err); }
    };
}