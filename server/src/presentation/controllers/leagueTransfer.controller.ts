import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../domain/errors/AppError';
import { LeagueTransferService } from '../../application/services/leagueTransfer.service';
import { PlaceDirectOfferDto, RaiseReleaseClauseDto } from '../routes/leagueTransfer.routes';

export class LeagueTransferController {
    constructor(private readonly service: LeagueTransferService) {}

    placeDirectOffer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const { sellerUserId, playerApiId, amount } = req.body as PlaceDirectOfferDto;
            const result = await this.service.placeDirectOffer(leagueId, req.userId!, sellerUserId, playerApiId, amount);
            res.status(201).json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    getReceivedOffers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const result = await this.service.getReceivedOffers(leagueId, req.userId!);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    getTransferHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const result = await this.service.getTransferHistory(leagueId);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    acceptOffer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const offerId = String(req.params.offerId ?? '');
            if (!offerId) throw new ValidationError('offerId invalido.');
            const result = await this.service.acceptOffer(leagueId, req.userId!, offerId);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    rejectOffer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const offerId = String(req.params.offerId ?? '');
            if (!offerId) throw new ValidationError('offerId invalido.');
            const result = await this.service.rejectOffer(leagueId, req.userId!, offerId);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    payReleaseClause = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const sellerUserId = String(req.params.sellerUserId ?? '');
            const playerApiId = Number(req.params.playerApiId);
            if (!sellerUserId || !Number.isInteger(playerApiId) || playerApiId <= 0) {
                throw new ValidationError('Parametros de clausula invalidos.');
            }

            const result = await this.service.payReleaseClause(leagueId, req.userId!, sellerUserId, playerApiId);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };

    raiseReleaseClause = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const playerApiId = Number(req.params.playerApiId);
            if (!Number.isInteger(playerApiId) || playerApiId <= 0) {
                throw new ValidationError('playerApiId invalido.');
            }

            const { contribution } = req.body as RaiseReleaseClauseDto;
            const result = await this.service.raiseReleaseClause(leagueId, req.userId!, playerApiId, contribution);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };
}
