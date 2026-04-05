// ─────────────────────────────────────────────────────────────────────────────
// services/scoring/CronistaFactory.ts
// Factory Method que instancia el cronista correcto dado un CronistaType.
// También expone sortearCronista() para asignación aleatoria por partido.
// ─────────────────────────────────────────────────────────────────────────────

import { CronistaType } from '../../../domain/models/scoring.models';
import { ICronistaStrategy } from './strategies/ICronistaStrategy';
import { CronistaAnalitico } from './strategies/CronistaAnalitico';
import { CronistaExigente }  from './strategies/CronistaExigente';
import { CronistaPasional }  from './strategies/CronistaPasional';

const CRONISTAS: Record<CronistaType, ICronistaStrategy> = {
    [CronistaType.ANALITICO]: new CronistaAnalitico(),
    [CronistaType.EXIGENTE]:  new CronistaExigente(),
    [CronistaType.PASIONAL]:  new CronistaPasional(),
};

const TIPOS: CronistaType[] = Object.values(CronistaType);

export class CronistaFactory {
    /** Devuelve el cronista correspondiente al tipo indicado */
    static crear(tipo: CronistaType): ICronistaStrategy {
        return CRONISTAS[tipo];
    }

    /** Sortea un cronista aleatorio — se llama una vez por partido */
    static sortear(): ICronistaStrategy {
        const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)];
        return CRONISTAS[tipo];
    }
}
