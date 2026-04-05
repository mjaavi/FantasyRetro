import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaExigente implements ICronistaStrategy {
    readonly tipo = CronistaType.EXIGENTE;

    calcularPicas(base: number): Picas {
        if (base < 2) return Picas.NEG;

        if (base < 5)  return seleccionarPorProbabilidad<Picas>([
            [0.70, Picas.SC],
            [0.30, Picas.P1],
        ]);
        if (base < 8)  return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.P1],
            [0.20, Picas.P2],
        ]);
        if (base < 11) return seleccionarPorProbabilidad<Picas>([
            [0.70, Picas.P2],
            [0.30, Picas.P3],
        ]);
        if (base < 14) return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.P3],
            [0.20, Picas.P4],
        ]);
        return Picas.P4;
    }
}
