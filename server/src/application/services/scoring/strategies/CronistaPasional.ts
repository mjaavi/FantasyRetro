import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaPasional implements ICronistaStrategy {
    readonly tipo = CronistaType.PASIONAL;

    calcularPicas(base: number): Picas {
        if (base < 0) return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.NEG],
            [0.20, Picas.P1],
        ]);
        if (base < 3) return seleccionarPorProbabilidad<Picas>([
            [0.50, Picas.P1],
            [0.50, Picas.P2],
        ]);
        if (base < 6) return seleccionarPorProbabilidad<Picas>([
            [0.30, Picas.P2],
            [0.70, Picas.P3],
        ]);
        if (base < 9) return seleccionarPorProbabilidad<Picas>([
            [0.20, Picas.P3],
            [0.80, Picas.P4],
        ]);
        return Picas.P4;
    }
}
