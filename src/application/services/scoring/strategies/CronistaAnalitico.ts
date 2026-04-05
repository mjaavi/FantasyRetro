import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaAnalitico implements ICronistaStrategy {
    readonly tipo = CronistaType.ANALITICO;

    calcularPicas(base: number): Picas {
        if (base < 2)           return Picas.NEG;
        if (base < 5)           return Picas.P1;
        if (base < 8)           return Picas.P2;
        if (base < 11)          return Picas.P3;
        if (base < 14)          return Picas.P4;
        return Picas.P4;
    }
}
