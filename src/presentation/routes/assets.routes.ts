import { Router } from 'express';
import { AssetsController } from '../controllers/assets.controller';

export function createAssetsRouter(ctrl: AssetsController): Router {
    const router = Router();

    router.get('/player-face/:playerFifaApiId', ctrl.proxyPlayerFace);
    router.get('/club-logo/:teamFifaApiId', ctrl.proxyClubLogo);

    return router;
}
