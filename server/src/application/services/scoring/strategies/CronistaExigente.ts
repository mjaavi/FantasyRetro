import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaExigente implements ICronistaStrategy {
    readonly tipo = CronistaType.EXIGENTE;

    calcularPicas(base: number): Picas {
        if (base < 0) return Picas.NEG;

        if (base < 3)  return seleccionarPorProbabilidad<Picas>([
            [0.70, Picas.SC],
            [0.30, Picas.P1],
        ]);
        if (base < 6)  return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.P1],
            [0.20, Picas.P2],
        ]);
        if (base < 9) return seleccionarPorProbabilidad<Picas>([
            [0.70, Picas.P2],
            [0.30, Picas.P3],
        ]);
        if (base < 12) return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.P3],
            [0.20, Picas.P4],
        ]);
        return Picas.P4;
    }
}
