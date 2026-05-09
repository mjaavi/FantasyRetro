import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaAnalitico implements ICronistaStrategy {
    readonly tipo = CronistaType.ANALITICO;

    calcularPicas(base: number): Picas {
        if (base < 0)            return Picas.NEG;
        if (base < 3)            return Picas.P1;
        if (base < 6)            return Picas.P2;
        if (base < 9)            return Picas.P3;
        if (base < 12)           return Picas.P4;
        return Picas.P4;
    }
}
